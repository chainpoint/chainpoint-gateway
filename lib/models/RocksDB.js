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
const utils = require('../utils.js')

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

const prefixBuffers = {
  PROOF_STATE_INDEX: Buffer.from('\xa1'),
  PROOF_STATE_VALUE: Buffer.from('\xa2'),
  INCOMING_HASH_OBJECTS: Buffer.from('\xb1')
}
const RECENT_HASH_DATA_BINARY_KEY = Buffer.from('nodestats:last25:hashes')
const PRUNE_BATCH_SIZE = 1000
const PRUNE_INTERVAL_SECONDS = 10
let PRUNE_IN_PROGRESS = false

let db = null

async function openConnectionAsync () {
  return new Promise((resolve, reject) => {
    level(path.resolve('./rocksdb'), opts, (err, conn) => {
      if (err) {
        console.error(`ERROR : Unable to open database : ${err.message}`)
        process.exit(0)
      } else {
        db = conn
        resolve()
      }
    })
  })
}

/****************************************************************************************************
 * DEFINE SCHEMAS
 ****************************************************************************************************/
// #region SCHEMAS

const nodeProofDataItemSchema = new JSBinaryType({
  hashIdNode: 'Buffer',
  hash: 'Buffer',
  proofState: ['Buffer'],
  hashIdCore: 'Buffer'
})

const incomingHashObjectSchema = new JSBinaryType([{
  hash_id_node: 'Buffer',
  hash: 'Buffer'
}])

const recentHashDataSchema = new JSBinaryType([{
  hashIdNode: 'Buffer',
  hash: 'Buffer',
  submittedAt: 'date'
}])

// #endregion SCHEMAS

/****************************************************************************************************
 * PROOF STATE FUNCTIONS
 ****************************************************************************************************/
// #region PROOF STATE FUNCTIONS

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
            let err = `Error during proof state batch delete : ${error.message}`
            return reject(err)
          }
        }
      })
      .on('error', function (error) {
        let err = `Error reading proof state keys for pruning : ${error.message}`
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

async function pruneOldProofStateDataAsync () {
  let pruneTime = Date.now() - (env.PROOF_EXPIRE_MINUTES * 60 * 1000)
  try {
    await pruneProofStateDataSince(pruneTime)
  } catch (error) {
    console.error(`ERROR : An error occurred during proof state pruning : ${error.message}`)
  }
}

// #endregion PROOF STATE FUNCTIONS

/****************************************************************************************************
 * INCOMING HASH QUEUE FUNCTIONS
 ****************************************************************************************************/
// #region INCOMING HASH QUEUE FUNCTIONS

function createBinaryIncomingHashObjectsTimeIndexKey () {
  // generate a new key for the current time
  let timestampBuffer = Buffer.alloc(8)
  timestampBuffer.writeDoubleBE(Date.now())
  let rndBuffer = crypto.randomBytes(16)
  return Buffer.concat([prefixBuffers.INCOMING_HASH_OBJECTS, timestampBuffer, rndBuffer])
}

function createBinaryIncomingHashObjectsTimeIndexMin () {
  // generate the minimum key value for range query
  let minBoundsBuffer = Buffer.alloc(24, 0)
  return Buffer.concat([prefixBuffers.INCOMING_HASH_OBJECTS, minBoundsBuffer])
}

function createBinaryIncomingHashObjectsTimeIndexMax (timestamp) {
  // generate the maximum key value for range query up to given timestamp
  let timestampBuffer = Buffer.alloc(8, 0)
  timestampBuffer.writeDoubleBE(timestamp)
  let rndBuffer = Buffer.alloc(16, '~')
  return Buffer.concat([prefixBuffers.INCOMING_HASH_OBJECTS, timestampBuffer, rndBuffer])
}

function encodeIncomingHashObjectsValue (hashObjects) {
  hashObjects = hashObjects.map((hashObject) => {
    return {
      hash_id_node: Buffer.from(hashObject.hash_id_node.replace(/-/g, ''), 'hex'),
      hash: Buffer.from(hashObject.hash, 'hex')
    }
  })
  return incomingHashObjectSchema.encode(hashObjects)
}

function decodeIncomingHashObjectsValue (hashObjectsBinary) {
  if (hashObjectsBinary.length === 0) return []
  let hashObjects = incomingHashObjectSchema.decode(hashObjectsBinary)
  hashObjects = hashObjects.map((hashObject) => {
    return {
      hash_id_node: hexToUUIDv1(hashObject.hash_id_node.toString('hex')),
      hash: hashObject.hash.toString('hex')
    }
  })
  return hashObjects
}

async function queueIncomingHashObjectsAsync (hashObjects) {
  try {
    let incomingHashObjectsBinaryKey = createBinaryIncomingHashObjectsTimeIndexKey()
    let incomingHashObjectsValue = encodeIncomingHashObjectsValue(hashObjects)
    await db.put(incomingHashObjectsBinaryKey, incomingHashObjectsValue)
  } catch (error) {
    let err = `Unable to write incoming hash data : ${error.message}`
    throw err
  }
}

async function getIncomingHashesUpToAsync (maxTimestamp) {
  return new Promise((resolve, reject) => {
    let hashesObjects = []
    let delOpts = []
    let minIncomingHashObjectsBinaryKey = createBinaryIncomingHashObjectsTimeIndexMin()
    let maxIncomingHashObjectsBinaryKey = createBinaryIncomingHashObjectsTimeIndexMax(maxTimestamp)
    db.createReadStream({ gt: minIncomingHashObjectsBinaryKey, lte: maxIncomingHashObjectsBinaryKey })
      .on('data', async function (data) {
        hashesObjects.push(decodeIncomingHashObjectsValue(data.value))
        delOpts.push({ type: 'del', key: data.key })
      })
      .on('error', function (error) {
        let err = `Error reading incoming hashes : ${error.message}`
        return reject(err)
      })
      .on('end', async function () {
        try {
          await db.batch(delOpts)
        } catch (error) {
          return reject(error)
        }
        return resolve(hashesObjects)
      })
  })
}

// #endregion INCOMING HASH QUEUE FUNCTIONS

/****************************************************************************************************
 * EVENT METRICS FUNCTIONS
 ****************************************************************************************************/
// #region EVENT METRICS FUNCTIONS

async function getCountMetricsAsync () {
  return new Promise((resolve, reject) => {
    let counters = []
    let minNodeStatsCounterBinaryKey = Buffer.from('nodestats:counter:')
    let maxNodeStatsCounterBinaryKey = Buffer.from('nodestats:counter:~')
    db.createReadStream({ gt: minNodeStatsCounterBinaryKey, lt: maxNodeStatsCounterBinaryKey })
      .on('data', async function (data) {
        counters.push({
          key: data.key.toString(),
          value: data.value.readDoubleBE()
        })
      })
      .on('error', function (error) {
        let err = `Error reading counter : ${error.message}`
        return reject(err)
      })
      .on('end', async function () {
        return resolve(counters)
      })
  })
}

async function saveCountMetricsAsync (metricObjects, prunedKeys) {
  // update the metrics to the latest values
  for (let metricObject of metricObjects) {
    try {
      let metricObjectBinaryKey = Buffer.from(metricObject.key)
      let metricValueBuffer = Buffer.alloc(8, 0)
      metricValueBuffer.writeDoubleBE(metricObject.value)
      await db.put(metricObjectBinaryKey, metricValueBuffer)
    } catch (error) {
      let err = `Unable to write counter : ${metricObject.key} ${metricObject.value}: ${error.message}`
      throw err
    }
  }
  // prune data from the db that was pruned from memory
  if (prunedKeys.length > 0) {
    let delOpts = prunedKeys.map((key) => { return { type: 'del', key: key } })
    try {
      await db.batch(delOpts)
    } catch (error) {
      let err = `Unable to prune counter : ${error.message}`
      throw err
    }
  }
}

function encodeRecentHashDataValue (recentHashDataObjects) {
  recentHashDataObjects = recentHashDataObjects.map((hashDataItem) => {
    return {
      hashIdNode: Buffer.from(hashDataItem.hashIdNode.replace(/-/g, ''), 'hex'),
      hash: Buffer.from(hashDataItem.hash, 'hex'),
      submittedAt: new Date(hashDataItem.submittedAt)
    }
  })
  return recentHashDataSchema.encode(recentHashDataObjects)
}

function decodeRecentHashDataValue (recentHashDataObjectsBinary) {
  if (recentHashDataObjectsBinary.length === 0) return []
  let recentHashDataObjects = recentHashDataSchema.decode(recentHashDataObjectsBinary)
  recentHashDataObjects = recentHashDataObjects.map((hashDataItem) => {
    return {
      hashIdNode: hexToUUIDv1(hashDataItem.hashIdNode.toString('hex')),
      hash: hashDataItem.hash.toString('hex'),
      submittedAt: utils.formatDateISO8601NoMs(hashDataItem.submittedAt)
    }
  })
  return recentHashDataObjects
}

async function getRecentHashDataAsync () {
  try {
    let recentHashDataValue = await db.get(RECENT_HASH_DATA_BINARY_KEY)
    let recentHashDataObjects = decodeRecentHashDataValue(recentHashDataValue)
    return recentHashDataObjects
  } catch (error) {
    if (error.notFound) {
      return []
    } else {
      let err = `Unable to read recent hash data : ${error.message}`
      throw err
    }
  }
}

async function saveRecentHashDataAsync (recentHashDataObjects) {
  try {
    let recentHashDataValue = encodeRecentHashDataValue(recentHashDataObjects)
    await db.put(RECENT_HASH_DATA_BINARY_KEY, recentHashDataValue)
  } catch (error) {
    let err = `Unable to write recent hash data : ${error.message}`
    throw err
  }
}

// #endregion EVENT METRICS FUNCTIONS

/****************************************************************************************************
* GENERAL KEY - VALUE FUNCTIONS
****************************************************************************************************/
// #region GENERAL KEY - VALUE FUNCTIONS

async function setAsync (key, value) {
  try {
    await db.put(Buffer.from(`custom_key:${key}`), Buffer.from(value.toString()))
  } catch (error) {
    let err = `Unable to write key : ${error.message}`
    throw new Error(err)
  }
}

async function getAsync (key) {
  try {
    let result = await db.get(Buffer.from(`custom_key:${key}`))
    return result.toString()
  } catch (error) {
    if (error.notFound) {
      return null
    } else {
      let err = `Unable to read key : ${error.message}`
      throw new Error(err)
    }
  }
}

// #endregion GENERAL KEY - VALUE FUNCTIONS

/****************************************************************************************************
* SUPPORT FUNCTIONS
****************************************************************************************************/
// #region SUPPORT FUNCTIONS

function hexToUUIDv1 (hexString) {
  if (hexString.length < 32) return null
  return `${hexString.substring(0, 8)}-${hexString.substring(8, 12)}-${hexString.substring(12, 16)}-${hexString.substring(16, 20)}-${hexString.substring(20, 32)}`
}

// #endregion SUPPORT FUNCTIONS

/****************************************************************************************************
 * SET AUTOMATIC PRUNING INTERVALS
 ****************************************************************************************************/
// #region SET AUTOMATIC PRUNING INTERVALS

setInterval(async () => {
  if (!PRUNE_IN_PROGRESS) {
    PRUNE_IN_PROGRESS = true
    await pruneOldProofStateDataAsync()
    PRUNE_IN_PROGRESS = false
  }
}, PRUNE_INTERVAL_SECONDS * 1000)

// #endregion SET AUTOMATIC PRUNING INTERVALS

module.exports = {
  openConnectionAsync: openConnectionAsync,
  getProofStatesBatchByHashIdNodesAsync: getProofStatesBatchByHashIdNodesAsync,
  saveProofStatesBatchAsync: saveProofStatesBatchAsync,
  queueIncomingHashObjectsAsync: queueIncomingHashObjectsAsync,
  getIncomingHashesUpToAsync: getIncomingHashesUpToAsync,
  saveCountMetricsAsync: saveCountMetricsAsync,
  saveRecentHashDataAsync: saveRecentHashDataAsync,
  getCountMetricsAsync: getCountMetricsAsync,
  getRecentHashDataAsync: getRecentHashDataAsync,
  setAsync: setAsync,
  getAsync: getAsync
}
