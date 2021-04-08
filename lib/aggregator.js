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
const uuidTime = require('uuid-time')
let cores = require('./cores.js')
const BLAKE2s = require('blake2s-js')
let rocksDB = require('./models/RocksDB.js')
const uuidv1 = require('uuid/v1')
const logger = require('./logger.js')
const env = require('./parse-env.js').env

// a boolean value indicating whether or not aggregateSubmitAndPersistAsync is currently running
let AGG_IN_PROCESS = false

// The merkle tools object for building trees and generating proof paths
const merkleTools = new MerkleTools()

async function getSubmittedHashData() {
  let submittedHashData = [[], []]
  try {
    submittedHashData = await rocksDB.getIncomingHashesUpToAsync(Date.now())
  } catch (error) {
    logger.error('Could not read submitted hash data')
    return [[], []]
  }
  return submittedHashData
}

// Build a merkle tree from HashData queued in RocksDB, submit the root to Core, persist resulting state data
async function aggregateSubmitAndPersistAsync() {
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
      return Buffer.from(hashObj.hash, 'hex')
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
      nodeProofDataItem.proofId = hashesForTree[x].proof_id
      nodeProofDataItem.hash = hashesForTree[x].hash
      nodeProofDataItem.proofState = merkleTools.getProof(x, true)
      nodeProofDataItems.push(nodeProofDataItem)
    }

    // submit merkle root to Core
    try {
      let submitResults = await submitHashToCoresAsync(aggregationRoot)
      if (submitResults.length === 0) throw new Error(`Unable to submit hash to Core : No Cores responded`)

      submitResults = submitResults.filter(submitResult => {
        // Log all proofId values returned by Cores
        logger.info(
          `Aggregator : Core IP : ${submitResult.coreIP} : proofId : ${submitResult.proofId} : ${JSON.stringify(
            submitResult
          )} : ${hashesForTree.length}`
        )
        // validate BLAKE2s
        let hashTimestampMS = parseInt(uuidTime.v1(submitResult.proofId))
        let h = new BLAKE2s(32, {
          personalization: Buffer.from('CHAINPNT')
        })
        let hashStr = [
          hashTimestampMS.toString(),
          hashTimestampMS.toString().length,
          submitResult.hash,
          submitResult.hash.length
        ].join(':')
        h.update(Buffer.from(hashStr))
        let expectedData = Buffer.concat([Buffer.from([0x01]), h.digest().slice(27)]).toString('hex')
        let embeddedData = submitResult.proofId.slice(24)
        if (embeddedData !== expectedData) {
          logger.error(
            `Aggregator : Submit : HashID from Core refused : Cannot validate embedded BLAKE2s data : ${embeddedData} != ${expectedData}`
          )
          logger.error(`hashStr was ${hashStr}`)
          return false
        }
        return true
      })
      if (submitResults.length === 0)
        throw new Error(`Unable to submit hash to Core : No Cores responded with valid HashID`)

      // add the submission info including core IP and proofId values from Cores for each item in proofDataItems
      let submitId = uuidv1() // the identifier for all hashes submitted in this batch
      let coreInfo = submitResults.map(submitResult => {
        return {
          ip: submitResult.coreIP,
          proofId: submitResult.proofId
        }
      })
      nodeProofDataItems = nodeProofDataItems.map(nodeProofDataItem => {
        nodeProofDataItem.submission = {
          submitId: submitId,
          cores: coreInfo
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
        logger.warn(`Aggregator : Submit to Core : Could not purge submitted hashes : ${error.message}`)
      }

      let submittedIPs = submitResults.map(item => item.coreIP).toString()
      logger.info(`Aggregator : ${hashesForTree.length} hash(es) : Core IPs : ${submittedIPs} `)
    } catch (error) {
      logger.error(`Aggregator : Submit : ${error.message}`)
      if (error.stack) {
        logger.error(`Stacktrace: ${error.stack}`)
      }
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

  return response.map(item => {
    return {
      coreIP: item.ip,
      proofId: item.response.proof_id,
      hash: item.response.hash
    }
  })
}

function startAggInterval() {
  return setInterval(aggregateSubmitAndPersistAsync, env.AGGREGATION_INTERVAL_SECONDS * 1000)
}

module.exports = {
  startAggInterval: startAggInterval,
  // additional functions for testing purposes
  aggregateSubmitAndPersistAsync: aggregateSubmitAndPersistAsync,
  setRocksDB: db => {
    rocksDB = db
  },
  setCores: c => {
    cores = c
  }
}
