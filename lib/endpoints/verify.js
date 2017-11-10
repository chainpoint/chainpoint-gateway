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

const _ = require('lodash')
const chpParse = require('chainpoint-parse')
const errors = require('restify-errors')
const env = require('../parse-env.js')
const async = require('async')
const calendarBlock = require('../models/CalendarBlock.js').CalendarBlock
const coreHosts = require('../core-hosts.js')
const parallel = require('async-await-parallel')

async function ProcessVerifyTasksAsync (verifyTasks) {
  let processedTasks = []

  for (let x = 0; x < verifyTasks.length; x++) {
    let verifyTask = verifyTasks[x]

    let status = verifyTask.status
    if (status === 'malformed') {
      processedTasks.push({
        proof_index: verifyTask.proof_index,
        status: status
      })
      continue
    }

    let totalCount = 0
    let validCount = 0

    let anchorResults = []
    let confirmTasks = []
    for (let x = 0; x < verifyTask.anchors.length; x++) {
      confirmTasks.push(async () => { return confirmExpectedValueAsync(verifyTask.anchors[x].anchor) })
    }
    let confirmResults
    try {
      confirmResults = await parallel(confirmTasks, 20)
    } catch (error) {
      console.error(`ERROR : Could not confirm proof data`)
      throw new Error('error confirming proof data')
    }

    for (let x = 0; x < verifyTask.anchors.length; x++) {
      try {
        let anchor = verifyTask.anchors[x]
        let confirmResult = confirmResults[x]
        let anchorResult = {
          branch: anchor.branch || undefined,
          type: anchor.anchor.type,
          valid: confirmResult
        }
        totalCount++
        validCount = validCount + (anchorResult.valid === true ? 1 : 0)
        anchorResults.push(anchorResult)
      } catch (error) {
        console.error(`ERROR : Verification error`)
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
      hash_id_node: verifyTask.hash_id_node,
      hash_submitted_node_at: verifyTask.hash_submitted_node_at,
      hash_id_core: verifyTask.hash_id_core,
      hash_submitted_core_at: verifyTask.hash_submitted_core_at,
      anchors: anchorResults,
      status: status
    }
    processedTasks.push(result)
  }

  return processedTasks
}

function BuildVerifyTaskList (proofs) {
  let results = []
  let proofIndex = 0
  // extract id, time, anchors, and calculate expected values
  async.eachSeries(proofs, function (proof, eachCallback) {
    let parseObj = null
    if (typeof (proof) === 'string') { // then this should be a binary proof
      chpParse.parseBinary(proof, function (err, result) {
        if (!err) parseObj = result
        results.push(buildResultObject(parseObj, proofIndex++))
        return eachCallback(null)
      })
    } else if (typeof (proof) === 'object') { // then this should be a JSON proof
      chpParse.parseObject(proof, function (err, result) {
        if (!err) parseObj = result
        results.push(buildResultObject(parseObj, proofIndex++))
        return eachCallback(null)
      })
    }
  })

  return results
}

function buildResultObject (parseObj, proofIndex) {
  let hash = parseObj !== null ? parseObj.hash : undefined
  let hashIdNode = parseObj !== null ? parseObj.hash_id_node : undefined
  let hashSubmittedNodeAt = parseObj !== null ? parseObj.hash_submitted_node_at : undefined
  let hashIdCore = parseObj !== null ? parseObj.hash_id_core : undefined
  let hashSubmittedCoreAt = parseObj !== null ? parseObj.hash_submitted_core_at : undefined
  let expectedValues = parseObj !== null ? flattenExpectedValues(parseObj.branches) : undefined

  return {
    proof_index: proofIndex,
    hash: hash,
    hash_id_node: hashIdNode,
    hash_submitted_node_at: hashSubmittedNodeAt,
    hash_id_core: hashIdCore,
    hash_submitted_core_at: hashSubmittedCoreAt,
    anchors: expectedValues,
    status: parseObj === null ? 'malformed' : ''
  }
}

async function confirmExpectedValueAsync (anchorInfo) {
  let dataId = anchorInfo.anchor_id
  let anchorUri = anchorInfo.uris[0]
  let optionsUri = _.takeRight(anchorUri.split('/'), 3).join('/')
  let expectedValue = anchorInfo.expected_value
  switch (anchorInfo.type) {
    case 'cal':
      try {
        let block = await calendarBlock.findOne({ where: { type: 'cal', data_id: dataId }, attributes: ['hash'] })
        if (!block) {
          // check the Core calendar for the block in case the Node calendar does not have the latest blocks
          let options = {
            headers: {
              'Content-Type': 'application/json'
            },
            method: 'GET',
            uri: `/${optionsUri}`,
            json: true,
            gzip: true,
            resolveWithFullResponse: true
          }

          let response = await coreHosts.coreRequestAsync(options)
          block = { hash: response }
        }
        return (block.hash === expectedValue)
      } catch (error) {
        throw new Error(`Cannot perform Calendar anchor confirmation`)
      }
    case 'btc':
      try {
        let block = await calendarBlock.findOne({ where: { type: 'btc-c', dataId: dataId }, attributes: ['dataVal'] })
        if (!block) {
          // check the Core calendar for the block in case the Node calendar does not have the latest blocks
          let options = {
            headers: {
              'Content-Type': 'application/json'
            },
            method: 'GET',
            uri: `/${optionsUri}`,
            json: true,
            gzip: true,
            resolveWithFullResponse: true
          }

          let response = await coreHosts.coreRequestAsync(options)
          block = { dataVal: response }
        }
        let blockRoot = block.dataVal.match(/.{2}/g).reverse().join('')
        return (blockRoot === expectedValue)
      } catch (error) {
        throw new Error(`Cannot perform Bitcoin anchor confirmation`)
      }
    case 'eth':
      break
  }
}

function flattenExpectedValues (branchArray) {
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
async function postProofsForVerificationV1Async (req, res, next) {
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
    return next(new errors.InvalidArgumentError(`Invalid JSON body, proofs Array max size of ${env.POST_VERIFY_PROOFS_MAX} exceeded`))
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
  postProofsForVerificationV1Async: postProofsForVerificationV1Async,
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
  }
}
