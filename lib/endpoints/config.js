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

const env = require('../parse-env.js')
const calendarBlock = require('../models/CalendarBlock.js')
const coreHosts = require('../core-hosts.js')
const publicKeys = require('../public-keys')
const { version } = require('../../package.json')
const hash = require('object-hash')
const { isEmpty, find } = require('lodash')
const moment = require('moment')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

let CalendarBlock = calendarBlock.CalendarBlock

// The working set of public keys used to verify signatures
let publicKeySet = null

let registrationStatus = false

/**
 * Validate data signed by Core provided to the node
 *
 * @param {*} data - Data object
 * @param String signature <09b0ec65fa25>:<hash of data object> (Ex. "fcbc2ba6c808:Cvb7ZK5SYQpRIQ13IqFv9EtyH7D3IfHy6BkUof20HK1f1cFSW25vgWbLhk4c5C0wL+56XMbtHkbcLvjYof+iCA==")
 */
async function validateSignedDataAsync (data, signature) {
  let prefixedSigValues = signature.split(':')
  let pubKeyHash = prefixedSigValues[0]
  let sig = prefixedSigValues[1]

  // update publicKeySet if publicKeySet does not contain necessary key
  if (!publicKeySet[pubKeyHash]) publicKeySet = await publicKeys.getLatestCorePublicKeySetAsync(coreHosts, publicKeySet)

  // validate block signature
  let isValidSig = await publicKeys.validateSignatureAsync(hash(data).toString('hex'), publicKeySet[pubKeyHash], sig)
  if (!isValidSig) {
    console.error(`ERROR : Config : SignatureVerfication : Signature validation failed`)
    return false
  }

  return true
}

/**
 * GET /config handler
 *
 * Returns a configuration information object
 */
async function getConfigInfoV1Async (req, res, next) {
  // Get 'data' header from Core and persist to Redis if data is signed and is in correct format
  // 'data' is provided as a base64 encoded string.
  let dataFromCore = (req.headers && req.headers.data) ? JSON.parse(Buffer.from(req.headers.data, 'base64').toString('utf8')) : {}

  try {
    if (!isEmpty(dataFromCore)) {
      // Verify the signed data, if valid, persist to redis. If signature doesn't match discard the 'data'
      let signatureValidation = await validateSignedDataAsync(dataFromCore.data, dataFromCore.sig)

      if (signatureValidation) {
        let dataReceivedAt = Date.now()
        await redis.setAsync('dataFromCore', JSON.stringify(dataFromCore.data))
        await redis.setAsync('dataFromCoreLastReceived', dataReceivedAt)

        // For Public Nodes - Notify operators that last audit failed as a result to not passing the 'public_ip_pass' check
        let lastChallengeResponse = (await redis.getAsync('challenge_response')) || []
        let [lastChallengeCreateTime = 0, lastNodeChallengeResponse = ''] = lastChallengeResponse.split(':') // eslint-disable-line
        lastChallengeCreateTime = parseInt(lastChallengeCreateTime, 10)
        let lastAudit = find(dataFromCore.data.audits, ['audit_at', lastChallengeCreateTime])

        // Log message to console if failed last audit as a result of a 'public_ip_pass' failure
        if (lastAudit && !lastAudit.audit_passed && !lastAudit.public_ip_pass) {
          console.log(`ERROR: Audit : Last audit (${moment(lastChallengeCreateTime).format('YYYY-MM-DD HH:mm Z')} - ${lastChallengeCreateTime}) failed due to a Public IP failure.`)
        }
      } else {
        // Signature doesn't match and 'data' has been discarded. Log a message saying invalid data has been sent to node
        console.log('ERROR: Config : Core Data Signature Validation Failed')
      }
    }
  } catch (error) {
    console.log('ERROR: Config : There was a problem persisting Core data being sent to the node')
  }

  let topNodeBlock = await CalendarBlock.findOne({ attributes: ['id'], order: [['id', 'DESC']] })
  // get solution from redis
  let challengeResponse = await redis.getAsync('challenge_response')

  res.contentType = 'application/json'

  res.send(Object.assign(
    {},
    {
      version: version,
      proof_expire_minutes: env.PROOF_EXPIRE_MINUTES,
      get_proofs_max_rest: env.GET_PROOFS_MAX_REST,
      post_hashes_max: env.POST_HASHES_MAX,
      post_verify_proofs_max: env.POST_VERIFY_PROOFS_MAX,
      time: new Date().toISOString(),
      calendar: {
        height: topNodeBlock ? parseInt(topNodeBlock.id) : -1,
        audit_response: challengeResponse || null
      }
    }
  ))
  return next()
}

module.exports = {
  getConfigInfoV1Async: getConfigInfoV1Async,
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
    redis = redisClient
  },
  setRegistration: (status) => {
    registrationStatus = status
  },
  setPublicKeySet: (pubKeys) => { publicKeySet = pubKeys }
}
