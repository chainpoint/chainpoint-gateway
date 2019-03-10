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

const MerkleTools = require('merkle-tools')
const crypto = require('crypto')
const uuidTime = require('uuid-time')
let cores = require('./cores.js')
const BLAKE2s = require('blake2s-js')
let rocksDB = require('./models/RocksDB.js')
let eventMetrics = require('./event-metrics.js')
const uuidv1 = require('uuid/v1')

// the aggregation frequency, in seconds
const AGG_FOR_CORE_INTERVAL_SEC = 60

// a boolean value indicating whether or not aggregateAndSendToCoreAsync is currently running
let AGG_IN_PROCESS = false

// The merkle tools object for building trees and generating proof paths
const merkleTools = new MerkleTools()

async function getSubmittedHashData() {
  let submittedHashData = [[], []]
  try {
    submittedHashData = await rocksDB.getIncomingHashesUpToAsync(Date.now())
  } catch (error) {
    console.error('ERROR : Could not read submitted hash data')
    return [[], []]
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

  let [hashesForTree, hashDataForTreeDeleteOps] = await getSubmittedHashData()
  let aggregationRoot = null

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
    aggregationRoot = merkleTools.getMerkleRoot().toString('hex')
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

      let submitResults = await submitHashToCoresAsync(aggregationRoot)
      if (submitResults.length === 0) throw new Error(`Unable to submit hash to Core : No Cores responded`)

      submitResults = submitResults.filter(submitResult => {
        // validate BLAKE2s
        let hashTimestampMS = parseInt(uuidTime.v1(submitResult.hashIdCore))
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
        let embeddedData = submitResult.hashIdCore.slice(24)
        if (embeddedData !== expectedData) {
          console.error(`WARN : Aggregator : Submit : HashID from Core refused : Cannot validate embedded BLAKE2s data`)
          return false
        }
        return true
      })
      if (submitResults.length === 0)
        throw new Error(`Unable to submit hash to Core : No Cores responded with valid HashID`)

      // add the submission info including core IP and hashIdCore values from Cores for each item in proofDataItems
      let submitId = uuidv1() // the identifier for all hashes submitted in this batch
      nodeProofDataItems = nodeProofDataItems.map(nodeProofDataItem => {
        nodeProofDataItem.submission = {
          submitId: submitId,
          cores: submitResults.map(submitResult => {
            return {
              ip: submitResult.coreIP,
              hashIdCore: submitResult.hashIdCore
            }
          })
        }
        return nodeProofDataItem
      })

      // persist these proofDataItems to storage
      try {
        await rocksDB.saveProofStatesBatchAsync(nodeProofDataItems)
      } catch (error) {
        throw new Error(`Unable to persist proof state data to disk : ${error.message}`)
      }

      try {
        // Submission to Core was successful, purge hashes that were delivered from RocksDB
        await rocksDB.deleteBatchAsync(hashDataForTreeDeleteOps)
      } catch (error) {
        console.error(`ERROR : Aggregator : Submit to Core : Could not purge submitted hashes : ${error.message}`)
      }

      if (process.env.NODE_ENV !== 'test') {
        let submittedIPs = submitResults.map(item => item.coreIP).toString()
        console.log(`INFO : Aggregator : ${hashesForTree.length} hash(es) : Core IP(s) = ${submittedIPs} `)
      }
    } catch (error) {
      console.error(`ERROR : Aggregator : Submit : ${error.message}`)
    }
  }

  AGG_IN_PROCESS = false
  return aggregationRoot
}

async function submitHashToCoresAsync(hash) {
  let response = await cores.submitHashAsync(hash)
  if (response.length == 0) {
    throw new Error('No Response from any Core')
  }

  // Increase merkleRootSubmitted event metric by 1
  eventMetrics.captureEvent('merkleRootSubmitted', 1)

  return response.map(item => {
    return {
      coreIP: item.ip,
      hashIdCore: item.response.hash_id,
      hash: item.response.hash
    }
  })
}

function startAggInterval() {
  return setInterval(aggregateAndSendToCoreAsync, AGG_FOR_CORE_INTERVAL_SEC * 1000)
}

module.exports = {
  startAggInterval: startAggInterval,
  getAggIntervalSeconds: () => AGG_FOR_CORE_INTERVAL_SEC,
  // additional functions for testing purposes
  aggregateAndSendToCoreAsync: aggregateAndSendToCoreAsync,
  setEventMetrics: em => {
    eventMetrics = em
  },
  setRocksDB: db => {
    rocksDB = db
  },
  setCores: c => {
    cores = c
  }
}
