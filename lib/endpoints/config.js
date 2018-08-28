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
const coreHosts = require('../core-hosts.js')
const publicKeys = require('../public-keys')
const { version } = require('../../package.json')
const hash = require('object-hash')
const { isEmpty, find } = require('lodash')
const rocksDB = require('../models/RocksDB.js')

// The working set of public keys used to verify signatures
let publicKeySet = null

/**
 * Validate data signed by Core provided to the node
 *
 * @param {*} data - Data object
 * @param String signature <09b0ec65fa25>:<hash of data object> (Ex. "fcbc2ba6c808:Cvb7ZK5SYQpRIQ13IqFv9EtyH7D3IfHy6BkUof20HK1f1cFSW25vgWbLhk4c5C0wL+56XMbtHkbcLvjYof+iCA==")
 */
async function validateSignedDataAsync(data, signature) {
  let prefixedSigValues = signature.split(':')
  let pubKeyHash = prefixedSigValues[0]
  let sig = prefixedSigValues[1]

  // update publicKeySet if publicKeySet does not contain necessary key
  if (!publicKeySet[pubKeyHash])
    publicKeySet = await publicKeys.getLatestCorePublicKeySetAsync(
      coreHosts,
      publicKeySet
    )

  // validate block signature
  let isValidSig = await publicKeys.validateSignatureAsync(
    hash(data).toString('hex'),
    publicKeySet[pubKeyHash],
    sig
  )
  if (!isValidSig) {
    console.error(
      'ERROR : Config : SignatureVerfication : Signature validation failed'
    )
    return false
  }

  return true
}

/**
 * GET /config handler
 *
 * Returns a configuration information object
 */
async function getConfigInfoV1Async(req, res, next) {
  // Get 'data' header from Core and persist to Rocks if data is signed and is in correct format
  // 'data' is provided as a base64 encoded string.
  let dataFromCore =
    req.headers && req.headers.data
      ? JSON.parse(Buffer.from(req.headers.data, 'base64').toString('utf8'))
      : {}

  try {
    if (!isEmpty(dataFromCore)) {
      // Verify the signed data, if valid, persist to Rocks. If signature doesn't match discard the 'data'
      let signatureValidation = await validateSignedDataAsync(
        dataFromCore.data,
        dataFromCore.sig
      )

      if (signatureValidation) {
        let dataReceivedAt = Date.now()
        await rocksDB.setAsync(
          'dataFromCore',
          JSON.stringify(dataFromCore.data)
        )
        await rocksDB.setAsync('dataFromCoreLastReceived', dataReceivedAt)

        // For Public Nodes - Notify operators that last audit failed as a result to not passing the 'public_ip_pass' check
        let lastChallengeResponse =
          (await rocksDB.getAsync('challenge_response')) || []
        let lastChallengeCreateTime = lastChallengeResponse.split(':')[0] || '0'
        lastChallengeCreateTime = parseInt(lastChallengeCreateTime, 10)
        let lastAudit = find(dataFromCore.data.audits, [
          'audit_at',
          lastChallengeCreateTime
        ])

        // Log message to console if failed last audit as a result of a 'public_ip_pass' failure
        if (lastAudit) {
          // prettier-ignore
          let lastAuditChecks = {
            'audit': lastAudit.audit_passed ? 'passed' : 'failed',
            'tnt-balance': lastAudit.tnt_balance_pass ? 'pass' : 'fail',
            'public-ip': lastAudit.public_ip_pass ? 'pass' : 'fail',
            ...((lastAudit.public_ip_pass) ? { 'ntp-time': lastAudit.time_pass ? 'pass' : 'fail' } : {}),
            ...((lastAudit.public_ip_pass) ? { 'cal-state': lastAudit.cal_state_pass ? 'pass' : 'fail' } : {}),
            ...((lastAudit.public_ip_pass) ? { 'node-version': lastAudit.node_version_pass ? 'pass' : 'fail' } : {})
          }

          let lastAuditChecksVerboseOutput = (function(publicIpPass) {
            if (publicIpPass) {
              return ['ntp-time', 'cal-state', 'node-version']
                .map(currVal => {
                  return `, ${currVal}: ${lastAuditChecks[currVal]}`
                })
                .join('')
            } else {
              return ''
            }
          })(lastAudit.public_ip_pass)

          console.log(
            `INFO: Audit : audit ${lastAuditChecks.audit} (tnt-balance: ${
              lastAuditChecks['tnt-balance']
            }, public-ip: ${
              lastAuditChecks['public-ip']
            }${lastAuditChecksVerboseOutput})`
          )
        }
      } else {
        // Signature doesn't match and 'data' has been discarded. Log a message saying invalid data has been sent to node
        console.log('ERROR: Config : Core Data Signature Validation Failed')
      }
    }
  } catch (error) {
    console.log(
      'ERROR: Config : There was a problem persisting Core data being sent to the node'
    )
  }

  let topNodeBlock = await rocksDB.getTopCalendarBlockAsync()
  // get solution from rocks
  let challengeResponse = await rocksDB.getAsync('challenge_response')

  res.contentType = 'application/json'

  res.send(
    Object.assign(
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
    )
  )
  return next()
}

module.exports = {
  getConfigInfoV1Async: getConfigInfoV1Async,
  setPublicKeySet: pubKeys => {
    publicKeySet = pubKeys
  }
}
