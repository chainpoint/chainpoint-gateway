/**
 * Copyright 2017 Tierion
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/

// load environment variables
const env = require('../parse-env.js')

const errors = require('restify-errors')
const _ = require('lodash')
const utils = require('../utils.js')
const aggregator = require('../aggregator.js')
const BLAKE2s = require('blake2s-js')
const eventMetrics = require('../event-metrics.js')
const rocksDB = require('../models/RocksDB.js')

// Generate a v1 UUID (time-based)
// see: https://github.com/kelektiv/node-uuid
const uuidv1 = require('uuid/v1')

/**
 * Generate the values for the 'meta' property in a POST /hashes response.
 *
 * Returns an Object with metadata about a POST /hashes request
 * including a 'timestamp', and hints for estimated time to completion
 * for various operations.
 *
 * @returns {Object}
 */
function generatePostHashesResponseMetadata () {
  let metaDataObj = {}
  let timestamp = new Date()
  metaDataObj.submitted_at = utils.formatDateISO8601NoMs(timestamp)
  metaDataObj.processing_hints = generateProcessingHints(timestamp)

  return metaDataObj
}

/**
 * Generate the expected proof ready times for each proof stage
 *
 * @param {Date} timestampDate - The hash submission timestamp
 * @returns {Object} An Object with 'cal', 'eth', and 'btc' properties
 *
 */
function generateProcessingHints (timestampDate) {
  let twoHoursFromTimestamp = utils.addMinutes(timestampDate, 120)
  let oneHourFromTopOfTheHour = new Date(twoHoursFromTimestamp.setHours(twoHoursFromTimestamp.getHours(), 0, 0, 0))
  let calHint = utils.formatDateISO8601NoMs(utils.addSeconds(timestampDate, 10 + aggregator.getAggIntervalSeconds()))
  // let ethHint = utils.formatDateISO8601NoMs(utils.addMinutes(timestampDate, 41))
  let btcHint = utils.formatDateISO8601NoMs(oneHourFromTopOfTheHour)

  return {
    cal: calHint,
    // eth: ethHint,
    btc: btcHint
  }
}

/**
 * Converts an array of hash strings to a object suitable to
 * return to HTTP clients.
 *
 * @param {string[]} hashes - An array of string hashes to process
 * @returns {Object} An Object with 'meta' and 'hashes' properties
 */
function generatePostHashesResponse (hashes) {
  let lcHashes = utils.lowerCaseHashes(hashes)

  let hashObjects = lcHashes.map((hash) => {
    // Compute a five byte BLAKE2s hash of the
    // timestamp that will be embedded in the UUID.
    // This allows the UUID to verifiably reflect the
    // combined NTP time and the hash submitted. Thus these values
    // are represented both in the BLAKE2s hash and in
    // the full timestamp embedded in the v1 UUID.
    //
    // RFC 4122 allows the MAC address in a version 1
    // (or 2) UUID to be replaced by a random 48-bit Node ID,
    // either because the node does not have a MAC address, or
    // because it is not desirable to expose it. In that case, the
    // RFC requires that the least significant bit of the first
    // octet of the Node ID should be set to `1`. This code
    // uses a five byte BLAKE2s hash as a verifier in place
    // of the MAC address. This also prevents leakage of server
    // info.
    //
    // This value can be checked on receipt of the hash_id UUID
    // by extracting the bytes of the last segment of the UUID.
    // e.g. If the UUID is 'b609358d-7979-11e7-ae31-01ba7816bf8f'
    // the Node ID hash is the six bytes shown in '01ba7816bf8f'.
    // Any client that can access the timestamp in the UUID and
    // the original hash can recompute the verification hash and
    // compare it.
    //
    // The UUID can also be verified for correct time by a
    // client that itself has an accurate NTP clock at the
    // moment when returned to the client. This allows
    // a client to verify, likely within a practical limit
    // of approximately 500ms depending on network latency,
    // the accuracy of the returned UUIDv1 timestamp.
    //
    // See JS API for injecting time and Node ID in the UUID API:
    // https://github.com/kelektiv/node-uuid/blob/master/README.md
    //
    // 5 byte length BLAKE2s hash w/ personalization

    let timestampMS = Date.now()
    let h = new BLAKE2s(5, { personalization: Buffer.from('CHAINPNT') })
    let hashStr = [
      timestampMS.toString(),
      timestampMS.toString().length,
      hash,
      hash.length
    ].join(':')

    h.update(Buffer.from(hashStr))

    let hashId = uuidv1({
      msecs: timestampMS,
      node: Buffer.concat([Buffer.from([0x01]), h.digest()])
    })

    let hashObj = {}
    hashObj.hash_id_node = hashId
    hashObj.hash = hash
    return hashObj
  })

  return {
    meta: generatePostHashesResponseMetadata(hashObjects),
    hashes: hashObjects
  }
}

/**
 * POST /hashes handler
 *
 * Expects a JSON body with the form:
 *   {"hashes": ["hash1", "hash2", "hashN"]}
 *
 * The `hashes` key must reference a JSON Array
 * of strings representing each hash to anchor.
 *
 * Each hash must be:
 * - in Hexadecimal form [a-fA-F0-9]
 * - minimum 40 chars long (e.g. 20 byte SHA1)
 * - maximum 128 chars long (e.g. 64 byte SHA512)
 * - an even length string
 */
async function postHashesV1Async (req, res, next) {
  res.contentType = 'application/json'

  // validate content-type sent was 'application/json'
  if (req.contentType() !== 'application/json') {
    return next(new errors.InvalidArgumentError('invalid content type'))
  }

  // validate params has parse a 'hashes' key
  if (!req.params.hasOwnProperty('hashes')) {
    return next(new errors.InvalidArgumentError('invalid JSON body, missing hashes'))
  }

  // validate hashes param is an Array
  if (!_.isArray(req.params.hashes)) {
    return next(new errors.InvalidArgumentError('invalid JSON body, hashes is not an Array'))
  }

  // validate hashes param Array has at least one hash
  if (_.size(req.params.hashes) < 1) {
    return next(new errors.InvalidArgumentError('invalid JSON body, hashes Array is empty'))
  }

  // validate hashes param Array is not larger than allowed max length
  if (_.size(req.params.hashes) > env.POST_HASHES_MAX) {
    return next(new errors.InvalidArgumentError(`invalid JSON body, hashes Array max size of ${env.POST_HASHES_MAX} exceeded`))
  }

  // validate hashes are individually well formed
  let containsValidHashes = _.every(req.params.hashes, (hash) => {
    return /^([a-fA-F0-9]{2}){20,64}$/.test(hash)
  })

  if (!containsValidHashes) {
    return next(new errors.InvalidArgumentError('invalid JSON body, invalid hashes present'))
  }

  let responseObj = generatePostHashesResponse(req.params.hashes)
  // Capture nodestats -> hashesReceived
  eventMetrics.captureEvent('hashes', responseObj.hashes.length)
  // Persist hash_id_node to a capped redis list for the Node Stats UI -> nodestats:last25HashIds
  for (let hashObj of responseObj.hashes) {
    eventMetrics.logRecentHash(hashObj.hash_id_node, hashObj.hash, responseObj.meta.submitted_at)
  }

  // store hash data for later aggregation
  try {
    await rocksDB.queueIncomingHashObjectsAsync(responseObj.hashes)
  } catch (error) {
    return next(new errors.InternalServerError('Could not save hash data'))
  }

  res.send(responseObj)
  return next()
}

module.exports = {
  postHashesV1Async: postHashesV1Async,
  generatePostHashesResponse: generatePostHashesResponse,
  setRedis: (redisClient) => {
    aggregator.setRedis(redisClient)
  },
  setHmacKey: (hmacKey) => { aggregator.setHmacKey(hmacKey) },
  startAggInterval: (interval) => { aggregator.startAggInterval(interval) }
}
