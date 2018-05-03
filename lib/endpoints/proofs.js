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
const _ = require('lodash')
const parallel = require('async-await-parallel')
const cachedProofs = require('../cached-proofs.js')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

let captureEvent

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

  // Capture nodestats -> proofsRetrieved
  captureEvent('proofsRetrieved', hashIds.length)

  let requestedType = req.accepts(JSONLD_MIME_TYPE) && !req.accepts(BASE64_MIME_TYPE) ? JSONLD_MIME_TYPE : BASE64_MIME_TYPE

  // get all associated hash_id_core and core hosts for each
  // requested hash_id_node from the Redis lookup table
  let nodeCoreLookups = {}
  try {
    for (let x = 0; x < hashIds.length; x++) {
      // check to see if hash_id_node is undefined in nodeCoreLookups, if it is
      // then get the Node <--> Core association from Redis and add it to the nodeCoreLookups object,
      // otherwise continue on to the next one
      let hashIdNode = hashIds[x]
      if (nodeCoreLookups[hashIdNode] === undefined) {
        let lookupKey = `${env.HASH_NODE_LOOKUP_KEY_PREFIX}:${hashIdNode}`
        let hashIdCore = await redis.getAsync(lookupKey)
        nodeCoreLookups[hashIdNode] = hashIdCore
      }
    }
  } catch (error) {
    return next(new errors.InternalError('error retrieving proof lookup data'))
  }

  // Many hash_id_nodes may be associated with the same hash_id_core, which will
  // result in duplicate hashIdCores in nodeCoreLookups. We only need to
  // query Core for the Core proof once per hashIdCore, so reduce nodeCoreLookups down
  // to unique values and use that deduplicated list for all future processing

  // get an array of all hashIdCores
  let allHashIdCores = Object.keys(nodeCoreLookups).map((hashIdNode) => {
    return nodeCoreLookups[hashIdNode]
  })

  // deduplicate the array
  let uniqueHashIdCores = _.uniqWith(allHashIdCores, _.isEqual)

  // limit requests to batches of 250, if necessary
  let hashIdCoreBatches = []
  while (uniqueHashIdCores.length > 0) {
    hashIdCoreBatches.push(uniqueHashIdCores.splice(0, 250))
  }

  let getProofTasks = []
  // query for proofs for all batches simultaneously, creating array of get proof task promises
  hashIdCoreBatches.forEach((hashIdCoreBatch) => {
    getProofTasks.push(async () => { return cachedProofs.getCachedCoreProofsAsync(hashIdCoreBatch) })
  })
  // await the resolution of all promises and then process the array of results
  let resultBatches = []
  if (getProofTasks.length > 0) {
    try {
      resultBatches = await parallel(getProofTasks, 20)
    } catch (error) {
      console.error(`ERROR : Could not get proofs from Core`)
      return next(new errors.InternalError('error retrieving proofs from Core'))
    }
  }

  // assemble all Core proofs received into an object keyed by hash_id_core
  let coreProofResults = {}
  resultBatches.forEach((resultBatch) => {
    resultBatch.forEach((proofResult) => {
      coreProofResults[proofResult.hash_id] = proofResult
    })
  })

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
      let hashIdCore = nodeCoreLookups[hashIdNode]
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
  let proofDataItem = nodeAggregationData.proof_data.find((dataItem) => {
    return dataItem.hash_id === hashIdNode
  })

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

module.exports = {
  getProofsByIDV1Async: getProofsByIDV1Async,
  setRedis: (redisClient) => {
    redis = redisClient
    cachedProofs.setRedis(redisClient)
    captureEvent = utils.captureEvent(redis)
  }
}
