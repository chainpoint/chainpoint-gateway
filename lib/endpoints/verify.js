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

let env = require('../parse-env.js').env
const _ = require('lodash')
const chpParse = require('chainpoint-parse')
const errors = require('restify-errors')
let cores = require('../cores.js')
const parallel = require('async-await-parallel')
const logger = require('../logger.js')

async function ProcessVerifyTasksAsync(verifyTasks) {
  let processedTasks = []

  for (let x = 0; x < verifyTasks.length; x++) {
    let verifyTask = verifyTasks[x]

    // check for malformatted proofs
    let status = verifyTask.status
    if (status === 'malformed') {
      processedTasks.push({
        proof_index: verifyTask.proof_index,
        status: status
      })
      continue
    }

    // check for anchors on unsupported network
    let supportedAnchorTypes = []
    // if this Node is running in mainnet mode, only accept mainnet anchors
    if (env.NETWORK === 'mainnet') supportedAnchorTypes = ['cal', 'btc']
    // if this Node is running in testnet mode, only accept testnet anchors
    if (env.NETWORK === 'testnet') supportedAnchorTypes = ['tcal', 'tbtc']
    // if there is a network mismatch, do not attempt to verify proof
    let mismatchFound = false
    for (let x = 0; x < verifyTask.anchors.length; x++) {
      if (!supportedAnchorTypes.includes(verifyTask.anchors[x].anchor.type)) {
        processedTasks.push({
          proof_index: verifyTask.proof_index,
          status: `This is a '${env.NETWORK}' Node supporting '${supportedAnchorTypes.join(
            "' and '"
          )}' anchor types. Cannot verify '${verifyTask.anchors[x].anchor.type}' anchors.`
        })
        mismatchFound = true
        break
      }
    }
    if (mismatchFound) continue

    // check for anchors on legacy anchors from old calendar
    // do not attempt to verify legacy anchors
    let hasLegacyAnchors = false
    for (let x = 0; x < verifyTask.anchors.length; x++) {
      if (!isNaN(verifyTask.anchors[x].anchor.anchor_id)) {
        processedTasks.push({
          proof_index: verifyTask.proof_index,
          status: `Cannot verify legacy anchors.`
        })
        hasLegacyAnchors = true
        break
      }
    }
    if (hasLegacyAnchors) continue

    let totalCount = 0
    let validCount = 0

    let anchorResults = []
    let confirmTasks = []
    for (let x = 0; x < verifyTask.anchors.length; x++) {
      confirmTasks.push(async () => {
        return confirmExpectedValueAsync(verifyTask.anchors[x].anchor)
      })
    }
    let confirmResults = []
    if (confirmTasks.length > 0) {
      try {
        confirmResults = await parallel(confirmTasks, 20)
      } catch (error) {
        logger.error('Could not confirm proof data')
        throw new Error('error confirming proof data')
      }
    }

    for (let x = 0; x < verifyTask.anchors.length; x++) {
      try {
        let anchor = verifyTask.anchors[x]
        let confirmResult = confirmResults[x]
        let anchorResult = {
          branch: anchor.branch || null,
          type: anchor.anchor.type,
          valid: confirmResult
        }
        totalCount++
        validCount = validCount + (anchorResult.valid === true ? 1 : 0)
        anchorResults.push(anchorResult)
      } catch (error) {
        logger.error('Verification error')
      }
    }

    if (validCount === 0) {
      status = 'invalid'
    } else if (validCount === totalCount) {
      status = 'verified'
    } else {
      status = 'mixed'
    }

    let result = {
      proof_index: verifyTask.proof_index,
      hash: verifyTask.hash,
      proof_id: verifyTask.proof_id,
      hash_received: verifyTask.hash_submitted_node_at,
      anchors: anchorResults,
      status: status
    }
    processedTasks.push(result)
  }

  return processedTasks
}

function BuildVerifyTaskList(proofs) {
  let results = []
  let proofIndex = 0

  // extract id, time, anchors, and calculate expected values
  _.forEach(proofs, proof => {
    try {
      let parseObj = chpParse.parse(proof)
      results.push(buildResultObject(parseObj, proofIndex++))
    } catch (error) {
      // continue regardless of error
      results.push(buildResultObject(null, proofIndex++))
    }
  })

  return results
}

function buildResultObject(parseObj, proofIndex) {
  let hash = parseObj !== null ? parseObj.hash : undefined
  let proofId = parseObj !== null ? parseObj.proof_id : undefined
  let hashReceived = parseObj !== null ? parseObj.hash_received : undefined
  let expectedValues = parseObj !== null ? flattenExpectedValues(parseObj.branches) : undefined

  return {
    proof_index: proofIndex,
    hash: hash,
    proof_id: proofId,
    hash_received: hashReceived,
    anchors: expectedValues,
    status: parseObj === null ? 'malformed' : ''
  }
}

async function confirmExpectedValueAsync(anchorInfo) {
  let anchorUri = anchorInfo.uris[0]
  let anchorTxId = _.takeRight(anchorUri.split('/'), 2)[0]
  let expectedValue = anchorInfo.expected_value

  // check Core for the transaction
  let txInfo = await cores.getCachedTransactionAsync(anchorTxId)
  if (txInfo === null || txInfo.tx === undefined || txInfo.tx.data === undefined) {
    throw new Error('Unable to retrieve transaction from Core to the confirm the anchor value')
  }

  return txInfo.tx.data === expectedValue
}

function flattenExpectedValues(branchArray) {
  let results = []
  for (let b = 0; b < branchArray.length; b++) {
    let anchors = branchArray[b].anchors
    if (anchors.length > 0) {
      for (let a = 0; a < anchors.length; a++) {
        results.push({
          branch: branchArray[b].label || undefined,
          anchor: anchors[a]
        })
      }
    }
    if (branchArray[b].branches) {
      results = results.concat(flattenExpectedValues(branchArray[b].branches))
    }

    return results
  }
}

/**
 * POST /verify handler
 *
 * Expects a JSON body with the form:
 *   {"proofs": [ {proofJSON1}, {proofJSON2}, {proofJSON3} ]}
 *   or
 *   {"proofs": [ "proof binary 1", "proof binary 2", "proof binary 3" ]}
 *
 * The `proofs` key must reference a JSON Array of chainpoint proofs.
 * Proofs may be in either JSON form or base64 encoded binary form.
 *
 */
async function postProofsForVerificationAsync(req, res, next) {
  res.contentType = 'application/json'

  // validate content-type sent was 'application/json'
  if (req.contentType() !== 'application/json') {
    return next(new errors.InvalidArgumentError('Invalid content type'))
  }

  // validate params has parse a 'proofs' key
  if (!req.params.hasOwnProperty('proofs')) {
    return next(new errors.InvalidArgumentError('Invalid JSON body, missing proofs'))
  }

  // validate proofs param is an Array
  if (!_.isArray(req.params.proofs)) {
    return next(new errors.InvalidArgumentError('Invalid JSON body, proofs is not an Array'))
  }

  // validate proofs param Array has at least one hash
  if (_.size(req.params.proofs) < 1) {
    return next(new errors.InvalidArgumentError('Invalid JSON body, proofs Array is empty'))
  }

  // validate proofs param Array is not larger than allowed max length
  if (_.size(req.params.proofs) > env.POST_VERIFY_PROOFS_MAX) {
    return next(
      new errors.InvalidArgumentError(
        `Invalid JSON body, proofs Array max size of ${env.POST_VERIFY_PROOFS_MAX} exceeded`
      )
    )
  }

  let verifyTasks = BuildVerifyTaskList(req.params.proofs)
  let verifyResults
  try {
    verifyResults = await ProcessVerifyTasksAsync(verifyTasks)
  } catch (error) {
    return next(new errors.InternalError('Node internal error verifying proof(s)'))
  }

  res.send(verifyResults)
  return next()
}

module.exports = {
  postProofsForVerificationAsync: postProofsForVerificationAsync,
  // additional functions for testing purposes
  setCores: c => {
    cores = c
  },
  setENV: obj => {
    env = obj
  }
}
