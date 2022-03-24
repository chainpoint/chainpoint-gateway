/**
 * Copyright 2019 Tierion
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
let env = require('../parse-env.js').env

const errors = require('restify-errors')
const _ = require('lodash')
const utils = require('../utils.js')
let rocksDB = require('../models/RocksDB.js')
const logger = require('../logger.js')
const analytics = require('../analytics.js')
const { UlidMonotonic } = require('id128')

/**
 * Generate the values for the 'meta' property in a POST /hashes response.
 *
 * Returns an Object with metadata about a POST /hashes request
 * including a 'timestamp', and hints for estimated time to completion
 * for various operations.
 *
 * @returns {Object}
 */
function generatePostHashesResponseMetadata() {
  let metaDataObj = {}
  let timestamp = new Date()
  metaDataObj.hash_received = utils.formatDateISO8601NoMs(timestamp)
  metaDataObj.processing_hints = generateProcessingHints(timestamp)

  return metaDataObj
}

/**
 * Generate the expected proof ready times for each proof stage
 *
 * @param {Date} timestampDate - The hash submission timestamp
 * @returns {Object} An Object with 'cal' and 'btc' properties
 *
 */

function generateProcessingHints(timestampDate) {
  // cal proof aggregation occurs at :30 seconds past each minute
  // allow and extra 30 seconds for processing
  let maxLocalAggregationFromTimestamp = utils.addSeconds(timestampDate, env.AGGREGATION_INTERVAL_SECONDS)
  let maxSeconds = maxLocalAggregationFromTimestamp.getSeconds()
  let secondsUntil30Past = maxSeconds < 30 ? 30 - maxSeconds : 90 - maxSeconds
  let calHint = utils.formatDateISO8601NoMs(utils.addSeconds(maxLocalAggregationFromTimestamp, secondsUntil30Past + 30))
  let twoHoursFromTimestamp = utils.addMinutes(timestampDate, 120)
  let btcHint = utils.formatDateISO8601NoMs(twoHoursFromTimestamp)

  return {
    cal: calHint,
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
function generatePostHashesResponse(ip, hashes) {
  let lcHashes = utils.lowerCaseHashes(hashes)

  let hashObjects = lcHashes.map(hash => {
    let proofId
    try {
      proofId = UlidMonotonic.generate().toCanonical()
    } catch (error) {
      UlidMonotonic.reset()
      proofId = UlidMonotonic.generate().toCanonical()
    }

    let hashObj = {}
    hashObj.proof_id = proofId
    hashObj.hash = hash
    logger.info(`Created proof_id ${proofId}`)

    //send event to google UA
    var hashEvent = {
      ec: env.GATEWAY_NAME,
      ea: 'CreateProof',
      el: proofId,
      cd1: hash,
      cd2: utils.formatDateISO8601NoMs(new Date()),
      cd3: env.PUBLIC_IP,
      cd4: ip,
      dp: '/hash'
    }
    analytics.setClientID(proofId)
    analytics.sendEvent(hashEvent)
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
async function postHashesAsync(req, res, next) {
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
    return next(
      new errors.InvalidArgumentError(`invalid JSON body, hashes Array max size of ${env.POST_HASHES_MAX} exceeded`)
    )
  }

  // validate hashes are individually well formed
  let containsValidHashes = _.every(req.params.hashes, hash => {
    return /^([a-fA-F0-9]{2}){20,64}$/.test(hash)
  })

  if (!containsValidHashes) {
    return next(new errors.InvalidArgumentError('invalid JSON body, invalid hashes present'))
  }

  let ip = utils.getClientIP(req)
  logger.info(`Incoming hash from ${ip}`)
  let responseObj = generatePostHashesResponse(ip, req.params.hashes)

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
  postHashesAsync: postHashesAsync,
  generatePostHashesResponse: generatePostHashesResponse,
  // additional functions for testing purposes
  setRocksDB: db => {
    rocksDB = db
  },
  setENV: obj => {
    env = obj
  }
}
