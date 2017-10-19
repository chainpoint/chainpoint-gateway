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

const errors = require('restify-errors')
const env = require('../parse-env.js')
const utils = require('../utils.js')
const uuidValidate = require('uuid-validate')
const uuidTime = require('uuid-time')
const chpBinary = require('chainpoint-binary')
const cpb = require('chainpoint-binary')
const _ = require('lodash')
const coreHosts = require('../core-hosts.js')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

// The custom MIME type for JSON proof array results containing Base64 encoded proof data
const BASE64_MIME_TYPE = 'application/vnd.chainpoint.json+base64'

// The custom MIME type for JSON proof array results containing Base64 encoded proof data
const JSONLD_MIME_TYPE = 'application/vnd.chainpoint.ld+json'

/**
 * GET /proofs/:hash_id handler
 *
 * Expects a path parameter 'hash_id' in the form of a Version 1 UUID
 *
 * Returns a chainpoint proof for the requested Hash ID
 */
async function getProofsByIDV1Async (req, res, next) {
  res.contentType = 'application/json'

  let hashIds = []

  // check if hash_id parameter was included
  if (req.params && req.params.hash_id_node) {
    // a hash_id was specified in the url, so use that hash_id only

    if (!uuidValidate(req.params.hash_id_node, 1)) {
      return next(new errors.InvalidArgumentError('invalid request, bad hash_id'))
    }

    hashIds.push(req.params.hash_id_node)
  } else if (req.headers && req.headers.hashids) {
    // no hash_id was specified in url, read from headers.hashids
    hashIds = req.headers.hashids.split(',')
  }

  // ensure at least one hash_id was submitted
  if (hashIds.length === 0) {
    return next(new errors.InvalidArgumentError('invalid request, at least one hash id required'))
  }

  // ensure that the request count does not exceed the maximum setting
  if (hashIds.length > env.GET_PROOFS_MAX_REST) {
    return next(new errors.InvalidArgumentError('invalid request, too many hash ids (' + env.GET_PROOFS_MAX_REST + ' max)'))
  }

  let requestedType = req.accepts(JSONLD_MIME_TYPE) ? JSONLD_MIME_TYPE : BASE64_MIME_TYPE

  // get all associated hash_id_core and core hosts for each
  // requested hash_id_node from the Redis lookup table
  let nodeCoreLookups = {}
  try {
    for (let x = 0; x < hashIds.length; x++) {
      let lookupKey = `${env.HASH_NODE_LOOKUP_KEY_PREFIX}:${hashIds[x]}`
      let lookupValue = await redis.getAsync(lookupKey)
      if (!lookupValue) continue
      let hashIdNode = lookupKey.split(':')[1]
      let lookupItems = lookupValue.split(':')
      let hashIdCore = lookupItems[0]
      let coreHost = lookupItems[1]
      nodeCoreLookups[hashIdNode] = {
        hashIdCore: hashIdCore,
        coreHost: coreHost
      }
    }
  } catch (error) {
    return next(new errors.InternalError('error retrieving proof lookup data'))
  }

  // get all proofs from Core for unique hash_id_core values needed
  let allHashIdCoreValues = Object.keys(nodeCoreLookups).map((key) => {
    return nodeCoreLookups[key].hashIdCore
  })
  let uniqueHashIdCoreValues = _.uniq(allHashIdCoreValues)
  // TODO: add support for retrieval in batches
  let coreProofResults = {}
  for (let x = 0; x < uniqueHashIdCoreValues.length; x++) {
    try {
      let results = await getProofsFromCoreByHashIdsAsync([uniqueHashIdCoreValues[x]])
      let proofResult = results[0]
      coreProofResults[uniqueHashIdCoreValues[x]] = proofResult
    } catch (error) {
      console.error(`ERROR : Could not get proof for ${uniqueHashIdCoreValues[x]} from Core`)
    }
  }

  // get Node aggregation data for each hash_id_core
  let nodeAggregationData = {}
  let aggKey
  try {
    for (let x = 0; x < Object.keys(coreProofResults).length; x++) {
      aggKey = `${env.CORE_SUBMISSION_KEY_PREFIX}:${Object.keys(coreProofResults)[x]}`
      let aggData = await redis.getAsync(aggKey)
      aggData = JSON.parse(aggData)
      nodeAggregationData[aggData.hash_id_core] = aggData
    }
  } catch (error) {
    console.error(`ERROR : Could not retrieve aggregation data from Redis for ${aggKey}`)
  }

  // build the resulting proofs from the collected data for each hash_id_node
  let results = []
  for (let x = 0; x < hashIds.length; x++) {
    let hashIdNode = hashIds[x]

    if (!nodeCoreLookups[hashIdNode]) {
      results.push({
        hash_id_node: hashIdNode,
        proof: null,
        anchors_complete: []
      })
    } else {
      let hashIdCore = nodeCoreLookups[hashIdNode].hashIdCore
      let coreProof = coreProofResults[hashIdCore] ? coreProofResults[hashIdCore].proof : null

      let fullProof = null
      if (coreProof) {
        fullProof = buildFullProof(hashIdNode, hashIdCore, coreProof, nodeAggregationData[hashIdCore])
      }

      let proofResult = fullProof
      if (requestedType === BASE64_MIME_TYPE && fullProof) proofResult = chpBinary.objectToBase64Sync(fullProof)

      results.push({
        hash_id_node: hashIdNode,
        proof: proofResult,
        anchors_complete: coreProofResults[hashIdCore] ? coreProofResults[hashIdCore].anchorsComplete : []
      })
    }
  }

  res.send(results)
  return next()
}

function buildFullProof (hashIdNode, hashIdCore, coreProof, nodeAggregationData) {
  if (!coreProof || !nodeAggregationData) return null

  // locate the matching proofDataItem in nodeAggregationData's proof_data
  let proofDataItem
  for (let x = 0; x < nodeAggregationData.proof_data.length; x++) {
    if (nodeAggregationData.proof_data[x].hash_id === hashIdNode) {
      proofDataItem = nodeAggregationData.proof_data[x]
      break
    }
  }

  let fullProofItem = {}
  fullProofItem.hash_id = proofDataItem.hash_id
  let fullProof = _.cloneDeep(coreProof)
  fullProof.hash_id_node = proofDataItem.hash_id
  fullProof.hash_submitted_node_at = utils.formatDateISO8601NoMs(new Date(parseInt(uuidTime.v1(fullProof.hash_id_node))))
  fullProof.hash = proofDataItem.hash
  for (let y = proofDataItem.partial_proof_path.length - 1; y >= 0; y--) {
    fullProof.branches[0].ops.unshift(proofDataItem.partial_proof_path[y])
  }
  fullProofItem.proof = fullProof
  return fullProofItem.proof
}

async function getProofsFromCoreByHashIdsAsync (hashIdArray) {
  let hashIdCSV = hashIdArray.join(',')
  let options = {
    headers: {
      'Content-Type': 'application/json',
      hashids: hashIdCSV
    },
    method: 'GET',
    uri: `/proofs`,
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let response
  try {
    response = await coreHosts.coreRequestAsync(options)
  } catch (error) {
    if (error.statusCode) throw new Error(`Invalid response on GET proof : ${error.statusCode}`)
    throw new Error(`No response received on GET proof`)
  }

  let proofResults = []

  for (let x = 0; x < response.length; x++) {
    let hashItem = response[x]
    if (hashItem.proof === null) {
      proofResults.push({ hash_id: hashItem.hash_id, proof: null })
    } else {
      let proofObject = null
      try {
        proofObject = cpb.binaryToObjectSync(hashItem.proof)
      } catch (err) {
        proofResults.push({ hash_id: hashItem.hash_id, proof: '' })
      }
      if (proofObject) {
        // a proof has been returned
        // Identify the anchors completed in this proof
        let anchorsComplete = utils.parseAnchorsComplete(proofObject)
        proofResults.push({ hash_id: hashItem.hash_id, proof: proofObject, anchorsComplete: anchorsComplete })
      }
    }
  }

  return proofResults
}

module.exports = {
  getProofsByIDV1Async: getProofsByIDV1Async,
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
    redis = redisClient
  }
}
