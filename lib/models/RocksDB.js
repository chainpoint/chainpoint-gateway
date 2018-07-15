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

const level = require('level-rocksdb')
const crypto = require('crypto')
const path = require('path')
const env = require('../parse-env.js')
const JSBinaryType = require('js-binary').Type

// See Options: https://github.com/level/leveldown#options
// Setup with options, all default except:
//   cacheSize : which was increased from 8MB to 32MB
let opts = {
  createIfMissing: true,
  errorIfExists: false,
  compression: true,
  cacheSize: 32 * 1024 * 1024,
  writeBufferSize: 4 * 1024 * 1024,
  blockSize: 4096,
  maxOpenFiles: 1000,
  blockRestartInterval: 16,
  maxFileSize: 2 * 1024 * 1024,
  keyEncoding: 'binary',
  valueEncoding: 'binary'
}

const db = level(path.resolve('./rocksdb'), opts)

const prefixBuffers = {
  PROOF_STATE_INDEX: Buffer.from('\xa1'),
  PROOF_STATE_VALUE: Buffer.from('\xa2')
}
const PRUNE_BATCH_SIZE = 1000
const PRUNE_INTERVAL_SECONDS = 10
let PRUNE_IN_PROGRESS = false

const nodeProofDataItemSchema = new JSBinaryType({
  hashIdNode: 'Buffer',
  hash: 'Buffer',
  proofState: ['Buffer'],
  hashIdCore: 'Buffer'
})

function hexToUUIDv1 (hexString) {
  if (hexString.length < 32) return null
  return `${hexString.substring(0, 8)}-${hexString.substring(8, 12)}-${hexString.substring(12, 16)}-${hexString.substring(16, 20)}-${hexString.substring(20, 32)}`
}

function createBinaryProofStateValueKey (hashIdNode) {
  let uuidBuffer = Buffer.from(hashIdNode.replace(/-/g, ''), 'hex')
  return Buffer.concat([prefixBuffers.PROOF_STATE_VALUE, uuidBuffer])
}

function createBinaryProofStateTimeIndexKey () {
  // generate a new key for the current time
  let timestampBuffer = Buffer.alloc(8)
  timestampBuffer.writeDoubleBE(Date.now())
  let rndBuffer = crypto.randomBytes(16)
  return Buffer.concat([prefixBuffers.PROOF_STATE_INDEX, timestampBuffer, rndBuffer])
}

function createBinaryProofStateTimeIndexMin () {
  // generate the minimum key value for range query
  let minBoundsBuffer = Buffer.alloc(24, 0)
  return Buffer.concat([prefixBuffers.PROOF_STATE_INDEX, minBoundsBuffer])
}

function createBinaryProofStateTimeIndexMax (timestamp) {
  // generate the maximum key value for range query up to given timestamp
  let timestampBuffer = Buffer.alloc(8, 0)
  timestampBuffer.writeDoubleBE(timestamp)
  let rndBuffer = Buffer.alloc(16, '~')
  return Buffer.concat([prefixBuffers.PROOF_STATE_INDEX, timestampBuffer, rndBuffer])
}

function encodeProofStateValue (nodeProofDataItem) {
  let stateObj = {
    hashIdNode: Buffer.from(nodeProofDataItem.hashIdNode.replace(/-/g, ''), 'hex'),
    hash: Buffer.from(nodeProofDataItem.hash, 'hex'),
    proofState: nodeProofDataItem.proofState,
    hashIdCore: Buffer.from(nodeProofDataItem.hashIdCore.replace(/-/g, ''), 'hex')
  }
  return nodeProofDataItemSchema.encode(stateObj)
}

function decodeProofStateValue (proofStateValue) {
  let leftCode = Buffer.from('\x00')
  let rightCode = Buffer.from('\x01')
  let stateObj = nodeProofDataItemSchema.decode(proofStateValue)
  let nodeProofDataItem = {
    hashIdNode: hexToUUIDv1(stateObj.hashIdNode.toString('hex')),
    hash: stateObj.hash.toString('hex'),
    proofState: stateObj.proofState.reduce((result, op, index, proofState) => {
      if (op.equals(leftCode)) result.push({ left: proofState[index + 1].toString('hex') })
      if (op.equals(rightCode)) result.push({ right: proofState[index + 1].toString('hex') })
      return result
    }, []),
    hashIdCore: hexToUUIDv1(stateObj.hashIdCore.toString('hex'))
  }
  return nodeProofDataItem
}

async function getProofStatesBatchByHashIdNodesAsync (hashIdNodes) {
  let results = []
  for (let hashIdNode of hashIdNodes) {
    try {
      let proofStateValueKey = createBinaryProofStateValueKey(hashIdNode)
      let proofStateValue = await db.get(proofStateValueKey)
      let nodeProofDataItem = decodeProofStateValue(proofStateValue)
      results.push(nodeProofDataItem)
    } catch (error) {
      if (error.notFound) {
        results.push({
          hashIdNode: hashIdNode,
          hash: null,
          proofState: null,
          hashIdCore: null
        })
      } else {
        let err = `Unable to read proof state for hash with hashIdNode = ${hashIdNode} : ${error.message}`
        throw err
      }
    }
  }
  return results
}

async function saveProofStatesBatchAsync (nodeProofDataItems) {
  let ops = []

  for (let nodeProofDataItem of nodeProofDataItems) {
    let proofStateValueKey = createBinaryProofStateValueKey(nodeProofDataItem.hashIdNode)
    let proofStateTimeIndexKey = createBinaryProofStateTimeIndexKey()
    let proofStateValue = encodeProofStateValue(nodeProofDataItem)
    ops.push({ type: 'put', key: proofStateValueKey, value: proofStateValue })
    ops.push({ type: 'put', key: proofStateTimeIndexKey, value: proofStateValueKey })
  }

  try {
    await db.batch(ops)
  } catch (error) {
    let err = `Unable to write proof state : ${error.message}`
    throw err
  }
}

async function pruneProofStateDataSince (timestampMS) {
  return new Promise((resolve, reject) => {
    let delOps = []
    let minKey = createBinaryProofStateTimeIndexMin()
    let maxKey = createBinaryProofStateTimeIndexMax(timestampMS)
    db.createReadStream({ gt: minKey, lte: maxKey })
      .on('data', async function (data) {
        delOps.push({ type: 'del', key: data.key })
        delOps.push({ type: 'del', key: data.value })
        // Execute in batches of PRUNE_BATCH_SIZE
        if (delOps.length >= PRUNE_BATCH_SIZE) {
          try {
            let delOpsBatch = delOps.splice(0)
            await db.batch(delOpsBatch)
          } catch (error) {
            let err = `Error during batch delete : ${error.message}`
            return reject(err)
          }
        }
      })
      .on('error', function (error) {
        let err = `Error reading keys for pruning : ${error.message}`
        return reject(err)
      })
      .on('end', async function () {
        try {
          await db.batch(delOps)
        } catch (error) {
          return reject(error.message)
        }
        return resolve()
      })
  })
}

async function pruneOldDataAsync () {
  if (!PRUNE_IN_PROGRESS) {
    PRUNE_IN_PROGRESS = true
    let pruneTime = Date.now() - (env.PROOF_EXPIRE_MINUTES * 60 * 1000)
    try {
      await pruneProofStateDataSince(pruneTime)
    } catch (error) {
      console.error(`ERROR : An error occurred during pruning : ${error.message}`)
    } finally {
      PRUNE_IN_PROGRESS = false
    }
  }
}

setInterval(pruneOldDataAsync, PRUNE_INTERVAL_SECONDS * 1000)

module.exports = {
  getProofStatesBatchByHashIdNodesAsync: getProofStatesBatchByHashIdNodesAsync,
  saveProofStatesBatchAsync: saveProofStatesBatchAsync
}
