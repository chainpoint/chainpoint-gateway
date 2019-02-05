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
const env = require('./parse-env.js')

const MerkleTools = require('merkle-tools')
const crypto = require('crypto')
const uuidTime = require('uuid-time')
const coreHosts = require('./core-hosts.js')
const BLAKE2s = require('blake2s-js')
const rocksDB = require('./models/RocksDB.js')
const eventMetrics = require('./event-metrics.js')

// the aggregation frequency, in seconds
const AGG_FOR_CORE_INTERVAL_SEC = 60

// a boolean value indicating whether or not aggregateAndSendToCoreAsync is currently running
let AGG_IN_PROCESS = false

// The merkle tools object for building trees and generating proof paths
const merkleTools = new MerkleTools()

async function getSubmittedHashData() {
  let submittedHashData = []
  try {
    submittedHashData = await rocksDB.getIncomingHashesUpToAsync(Date.now())
  } catch (error) {
    console.error('ERROR : Could not read submitted hash data')
    return []
  }
  return submittedHashData
}

// Build a merkle tree from HashData queued in RocksDB and submit the root to Core
async function aggregateAndSendToCoreAsync() {
  // Return if the previous call to this function has not yet completed
  if (AGG_IN_PROCESS) {
    return
  } else {
    AGG_IN_PROCESS = true
  }

  let [hashDataForTree, hashDataForTreeDeleteOps] = await getSubmittedHashData()

  // hashDataForTree is an array of arrays containing hash data, flatten to single array
  let hashesForTree = hashDataForTree.reduce((prev, curr) => {
    return [...prev, ...curr]
  }, [])

  if (hashesForTree.length > 0) {
    // clear the merkleTools instance to prepare for a new tree
    merkleTools.resetTree()

    // concatenate and hash the hash ids and hash values into new array
    let leaves = hashesForTree.map(hashObj => {
      let hashIdBuffer = Buffer.from(`node_id:${hashObj.hash_id_node}`, 'utf8')
      let hashBuffer = Buffer.from(hashObj.hash, 'hex')
      let concatAndHashBuffer = crypto
        .createHash('sha256')
        .update(Buffer.concat([hashIdBuffer, hashBuffer]))
        .digest()
      return concatAndHashBuffer
    })

    // Add every hash in hashesForTree to new Merkle tree
    merkleTools.addLeaves(leaves)
    merkleTools.makeTree()

    let nodeProofDataItems = []
    let aggregationMerkleRoot = merkleTools.getMerkleRoot().toString('hex')
    let treeSize = merkleTools.getLeafCount()

    for (let x = 0; x < treeSize; x++) {
      // push the hash_id and corresponding proof onto the array
      let nodeProofDataItem = {}
      nodeProofDataItem.hashIdNode = hashesForTree[x].hash_id_node
      nodeProofDataItem.hash = hashesForTree[x].hash
      nodeProofDataItem.proofState = merkleTools.getProof(x, true)
      nodeProofDataItems.push(nodeProofDataItem)
    }

    // submit merkle root to Core
    try {
      // TODO: HMAC has been removed, will need to update to accomodate new auth/jwt method
      let submitResult
      try {
        submitResult = await submitHashToCoreAsync(aggregationMerkleRoot)
      } catch (error) {
        throw new Error(`Unable to submit hash(es) to Core : ${error.message}`)
      }

      try {
        // Submission to Core was successful, purge hashes that were delivered from RocksDB
        await rocksDB.deleteBatchAsync(hashDataForTreeDeleteOps)
      } catch (error) {
        console.error(`ERROR : Aggregator : Submit to Core : Could not purge submitted hashes : ${error.message}`)
      }

      // validate BLAKE2s
      let hashTimestampMS = parseInt(uuidTime.v1(submitResult.hash_id))
      let h = new BLAKE2s(5, {
        personalization: Buffer.from('CHAINPNT')
      })
      let hashStr = [
        hashTimestampMS.toString(),
        hashTimestampMS.toString().length,
        submitResult.hash,
        submitResult.hash.length
      ].join(':')
      h.update(Buffer.from(hashStr))
      let expectedData = Buffer.concat([Buffer.from([0x01]), h.digest()]).toString('hex')
      let embeddedData = submitResult.hash_id.slice(24)
      if (embeddedData !== expectedData) {
        throw new Error('Hash ID from Core refused : Cannot validate embedded BLAKE2s data')
      }

      // add the hashIdCore value for each item in proofDataItems
      nodeProofDataItems = nodeProofDataItems.map(nodeProofDataItem => {
        nodeProofDataItem.hashIdCore = submitResult.hash_id
        return nodeProofDataItem
      })

      // persist these proofDataItems to storage
      try {
        await rocksDB.saveProofStatesBatchAsync(nodeProofDataItems)
      } catch (error) {
        throw new Error(`Unable to persist proof state data to disk : ${error.message}`)
      }

      console.log(`INFO : Aggregator : ${hashesForTree.length} hash(es) : Core hash ID = ${submitResult.hash_id} `)
    } catch (error) {
      console.error(`ERROR : Aggregator : Submit : ${error.message}`)
    }
  }

  AGG_IN_PROCESS = false
}

async function submitHashToCoreAsync(hash) {
  let options = {
    headers: {
      'Content-Type': 'application/json',
      'tnt-address': env.NODE_TNT_ADDRESS
    },
    method: 'POST',
    uri: '/hashes',
    body: {
      hash: hash
    },
    json: true,
    gzip: true,
    resolveWithFullResponse: true,
    misc: {
      retries: 0
    }
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
      throw new Error('No Response')
    }
  }

  // Increase merkleRootSubmitted event metric by 1
  eventMetrics.captureEvent('merkleRootSubmitted', 1)

  // TODO: References to credit balance have been removed from the result,
  // to be replaced with some new information later?
  let result = {
    hash_id: response.hash_id,
    hash: response.hash,
    processing_hints: response.processing_hints
  }
  return result
}

module.exports = {
  startAggInterval: () => {
    setInterval(aggregateAndSendToCoreAsync, AGG_FOR_CORE_INTERVAL_SEC * 1000)
  },
  getAggIntervalSeconds: () => AGG_FOR_CORE_INTERVAL_SEC
}
