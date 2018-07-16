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
const env = require('./parse-env.js')

const MerkleTools = require('merkle-tools')
const crypto = require('crypto')
const uuidTime = require('uuid-time')
const coreHosts = require('./core-hosts.js')
const BLAKE2s = require('blake2s-js')
const _ = require('lodash')
const rocksDB = require('./models/RocksDB.js')
const eventMetrics = require('./event-metrics.js')

// The key used to generate the HMAC for POST /hash and /proofs requests
let HMAC_KEY = null

// the aggregation frequency
let AGG_FOR_CORE_INTERVAL_SEC = 5
let aggForCoreIntervalInstance

// The merkle tools object for building trees and generating proof paths
const merkleTools = new MerkleTools()

async function getSubmittedHashData () {
  let submittedHashData = []
  try {
    submittedHashData = await rocksDB.getIncomingHashesUpToAsync(Date.now())
  } catch (error) {
    console.error(`ERROR : Could not read submitted hash data`)
    return []
  }
  return submittedHashData
}

// Build a merkle tree from HASHDATA hashes and submit the root to Core
async function aggregateAndSendToCoreAsync () {
  let hashDataForTree = await getSubmittedHashData()

  // get an array of hashes from hashDataForTree
  let hashesForTree = hashDataForTree.reduce((prev, curr) => {
    return [...prev, ...curr]
  }, [])

  if (hashesForTree.length > 0) {
    // console.log(`INFO : Aggregator : ${hashesForTree.length} hash(es) received`)

    // clear the merkleTools instance to prepare for a new tree
    merkleTools.resetTree()

    // concatenate and hash the hash ids and hash values into new array
    let leaves = hashesForTree.map((hashObj) => {
      let hashIdBuffer = Buffer.from(`node_id:${hashObj.hash_id_node}`, 'utf8')
      let hashBuffer = Buffer.from(hashObj.hash, 'hex')
      let concatAndHashBuffer = crypto.createHash('sha256').update(Buffer.concat([hashIdBuffer, hashBuffer])).digest()
      return concatAndHashBuffer
    })

    // Add every hash in hashesForTree to new Merkle tree
    merkleTools.addLeaves(leaves)
    merkleTools.makeTree()

    let nodeProofDataItems = []
    let aggregationMerkleRoot = merkleTools.getMerkleRoot().toString('hex')
    let treeSize = merkleTools.getLeafCount()

    for (let x = 0; x < treeSize; x++) {
      // push the hash_id and corresponding proof onto the array, inserting the UUID concat/hash step at the beginning
      let nodeProofDataItem = {}
      nodeProofDataItem.hashIdNode = hashesForTree[x].hash_id_node
      nodeProofDataItem.hash = hashesForTree[x].hash
      nodeProofDataItem.proofState = merkleTools.getProof(x, true)
      nodeProofDataItems.push(nodeProofDataItem)
    }

    // submit merkle root to Core
    try {
      let hash = crypto.createHmac('sha256', HMAC_KEY)
      let hmac = hash.update(env.NODE_TNT_ADDRESS).digest('hex')
      let submitResult = await submitHashToCoreAsync(aggregationMerkleRoot, hmac)

      // validate BLAKE2s
      let hashTimestampMS = parseInt(uuidTime.v1(submitResult.hash_id))
      let h = new BLAKE2s(5, { personalization: Buffer.from('CHAINPNT') })
      let hashStr = [
        hashTimestampMS.toString(),
        hashTimestampMS.toString().length,
        submitResult.hash,
        submitResult.hash.length,
        submitResult.nist,
        submitResult.nist.length
      ].join(':')
      h.update(Buffer.from(hashStr))
      let expectedData = Buffer.concat([Buffer.from([0x01]), h.digest()]).toString('hex')
      let embeddedData = submitResult.hash_id.slice(24)
      if (embeddedData !== expectedData) {
        throw new Error('Hash ID from Core refused: Cannot validate embedded BLAKE2s data')
      }

      // add the hashIdCore value for each item in proofDataItems
      nodeProofDataItems = nodeProofDataItems.map((nodeProofDataItem) => {
        nodeProofDataItem.hashIdCore = submitResult.hash_id
        return nodeProofDataItem
      })

      // persist these proofDataItems to storage
      try {
        await rocksDB.saveProofStatesBatchAsync(nodeProofDataItems)
      } catch (error) {
        let err = `Unable to persist proof state data to disk : ${error.message}`
        throw err
      }

      console.log(`INFO : Aggregator : ${hashesForTree.length} : ${submitResult.hash_id}`)
    } catch (error) {
      console.error(`ERROR : Aggregator : Submit : ${error.message}`)
    }
  }
}

async function submitHashToCoreAsync (hash, hmac) {
  let options = {
    headers: {
      'Content-Type': 'application/json',
      'tnt-address': env.NODE_TNT_ADDRESS
    },
    auth: {
      'bearer': hmac
    },
    method: 'POST',
    uri: `/hashes`,
    body: { hash: hash },
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let response
  try {
    response = await coreHosts.coreRequestAsync(options)
  } catch (error) {
    if (error.statusCode && error.message) {
      throw new Error(`${error.statusCode} : ${error.message}`)
    } else if (error.statusCode) {
      throw new Error(`${error.statusCode}`)
    } else {
      throw new Error(`No Response`)
    }
  }

  // Capture merkleRootSubmitted event type: nodestats -> merkleRootSubmitted
  eventMetrics.captureEvent('merkleRootSubmitted', 1)

  let result = {
    hash_id: response.hash_id,
    hash: response.hash,
    nist: response.nist,
    processing_hints: response.processing_hints,
    tnt_credit_balance: response.tnt_credit_balance
  }
  return result
}

module.exports = {
  startAggInterval: (newInterval = AGG_FOR_CORE_INTERVAL_SEC) => {
    // run aggregateToCore() at a regular interval
    // Create a new interval instance if one has not already been created
    if (_.isUndefined(aggForCoreIntervalInstance)) {
      AGG_FOR_CORE_INTERVAL_SEC = newInterval
      aggForCoreIntervalInstance = setInterval(aggregateAndSendToCoreAsync, newInterval * 1000)
    } else {
      if (newInterval && newInterval !== AGG_FOR_CORE_INTERVAL_SEC) {
        clearInterval(aggForCoreIntervalInstance)

        AGG_FOR_CORE_INTERVAL_SEC = newInterval
        aggForCoreIntervalInstance = setInterval(aggregateAndSendToCoreAsync, newInterval * 1000)
      }
    }
  },
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
  },
  setHmacKey: (hmacKey) => { HMAC_KEY = hmacKey },
  getAggIntervalSeconds: () => AGG_FOR_CORE_INTERVAL_SEC
}
