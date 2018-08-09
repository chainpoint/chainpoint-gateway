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
  INCOMING_HASH_OBJECTS: Buffer.from('\xb1'),
  PUBLIC_KEY_VALUE: Buffer.from('\xc1'),
  HMAC_KEY_VALUE: Buffer.from('\xd1'),
  CALENDAR_BLOCK_VALUE: Buffer.from('\xe1'),
  CALENDAR_BLOCK_CAL_DATAID_INDEX: Buffer.from('\xe2'),
  CALENDAR_BLOCK_BTCC_DATAID_INDEX: Buffer.from('\xe3')
}
const CALENDAR_TOP_BLOCK_BINARY_KEY = Buffer.from('calendar:topblock')
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

const hmacKeysSchema = new JSBinaryType({
  tntAddr: 'Buffer',
  hmacKey: 'Buffer',
  version: 'uint'
})

const calendarBlockSchema = new JSBinaryType({
  id: 'uint',
  time: 'uint',
  version: 'string', // storing as string for efficiency, convert back to integer during decode
  stackId: 'string',
  type: 'string',
  dataId: 'string',
  dataVal: 'string',
  prevHash: 'Buffer',
  hash: 'Buffer',
  sig: { pubKeyPrefix: 'Buffer', value: 'Buffer' }
})

// #endregion SCHEMAS

/****************************************************************************************************
 * CALENDAR FUNCTIONS
 ****************************************************************************************************/
// #region CALENDAR FUNCTIONS

function createBinaryCalendarBlockValueKeyByHeight (blockHeight) {
  let blockHeightBuffer = Buffer.alloc(4)
  blockHeightBuffer.writeUInt32BE(blockHeight)
  return Buffer.concat([prefixBuffers.CALENDAR_BLOCK_VALUE, blockHeightBuffer])
}

function createBinaryCalendarBlockTypeDataIdIndexKeyByTypeAndDataId (type, dataId) {
  // generate a new key for the block type and dataid
  let prefixBuffer
  switch (type) {
    case 'cal':
      prefixBuffer = prefixBuffers.CALENDAR_BLOCK_CAL_DATAID_INDEX
      break
    case 'btc-c':
      prefixBuffer = prefixBuffers.CALENDAR_BLOCK_BTCC_DATAID_INDEX
      break
    default:
      throw new Error('Unknown type for CalendarBlockTypeDataIdIndexKey')
  }
  let dataIdBuffer = Buffer.alloc(4)
  dataIdBuffer.writeUInt32BE(parseInt(dataId, 10))
  return Buffer.concat([prefixBuffer, dataIdBuffer])
}

function encodeCalendarBlockValue (calendarBlock) {
  let blockObj = {
    id: calendarBlock.id,
    time: calendarBlock.time,
    version: calendarBlock.version.toString(), // storing as string for efficiency, convert back to integer during decode
    stackId: calendarBlock.stackId,
    type: calendarBlock.type,
    dataId: calendarBlock.dataId,
    dataVal: calendarBlock.dataVal,
    prevHash: Buffer.from(calendarBlock.prevHash, 'hex'),
    hash: Buffer.from(calendarBlock.hash, 'hex'),
    sig: {
      pubKeyPrefix: Buffer.from(calendarBlock.sig.split(':')[0], 'hex'),
      value: Buffer.from(calendarBlock.sig.split(':')[1], 'base64')
    }
  }
  return calendarBlockSchema.encode(blockObj)
}

function decodeCalendarBlockValue (calendarBlockValue) {
  let calendarBlockObj = calendarBlockSchema.decode(calendarBlockValue)
  let calendarBlock = {
    id: calendarBlockObj.id,
    time: calendarBlockObj.time,
    version: parseInt(calendarBlockObj.version, 10), // storing as string for efficiency, convert back to integer during decode
    stackId: calendarBlockObj.stackId,
    type: calendarBlockObj.type,
    dataId: calendarBlockObj.dataId,
    dataVal: calendarBlockObj.dataVal,
    prevHash: calendarBlockObj.prevHash.toString('hex'),
    hash: calendarBlockObj.hash.toString('hex'),
    sig: `${calendarBlockObj.sig.pubKeyPrefix.toString('hex')}:${calendarBlockObj.sig.value.toString('base64')}`
  }
  return calendarBlock
}

function encodeCalendarBlockTypeDataIdIndexValue (calendarBlock) {
  // generate a value for the block type and dataid index
  let value
  switch (calendarBlock.type) {
    case 'cal':
      value = Buffer.from(calendarBlock.hash, 'hex')
      break
    case 'btc-c':
      value = Buffer.from(calendarBlock.dataVal, 'hex')
      break
    default:
      throw new Error('Unknown type for CalendarBlockTypeDataIdIndexValue')
  }
  return value
}

function decodeCalendarBlockTypeDataIdIndexValue (type, indexValue) {
  let value
  switch (type) {
    case 'cal':
      value = indexValue.toString('hex')
      break
    case 'btc-c':
      value = indexValue.toString('hex')
      break
    default:
      throw new Error('Unknown type for CalendarBlockTypeDataIdIndexValue')
  }
  return value
}

function encodeCalendarTopBlockHeightValue (topBlockHeight) {
  let heightBuffer = Buffer.alloc(4)
  heightBuffer.writeUInt32BE(topBlockHeight)
  return heightBuffer
}

function decodeCalendarTopBlockHeightValue (topBlockHeightValue) {
  return topBlockHeightValue.readUInt32BE(topBlockHeightValue)
}

async function saveCalendarBlockBatchAsync (calendarBlocks) {
  let ops = []
  let topBlockHeight = null
  for (let calendarBlock of calendarBlocks) {
    topBlockHeight = Math.max(topBlockHeight, calendarBlock.id)
    let calendarBlockValueKey = createBinaryCalendarBlockValueKeyByHeight(calendarBlock.id)
    let calendarBlockValue = encodeCalendarBlockValue(calendarBlock)
    ops.push({ type: 'put', key: calendarBlockValueKey, value: calendarBlockValue })
    // if cal or btc-c blocks, index appropriate verification value
    if (calendarBlock.type === 'cal' || calendarBlock.type === 'btc-c') {
      let calendarBlockTypeDataIdIndexKey = createBinaryCalendarBlockTypeDataIdIndexKeyByTypeAndDataId(calendarBlock.type, calendarBlock.dataId)
      let calendarBlockTypeDataIdIndexValue = encodeCalendarBlockTypeDataIdIndexValue(calendarBlock)
      ops.push({ type: 'put', key: calendarBlockTypeDataIdIndexKey, value: calendarBlockTypeDataIdIndexValue })
    }
  }
  if (ops.length > 0) {
    let calendarTopBlockHeightValue = encodeCalendarTopBlockHeightValue(topBlockHeight)
    ops.push({ type: 'put', key: CALENDAR_TOP_BLOCK_BINARY_KEY, value: calendarTopBlockHeightValue })
  }

  try {
    await db.batch(ops)
  } catch (error) {
    let err = `Unable to write calendar blocks : ${error.message}`
    throw err
  }
}

async function getTopCalendarBlockAsync () {
  try {
    let topCalendarBlockHeightValue = await db.get(CALENDAR_TOP_BLOCK_BINARY_KEY)
    let topCalendarBlockHeight = decodeCalendarTopBlockHeightValue(topCalendarBlockHeightValue)
    let topCalendarBlockValue = await db.get(createBinaryCalendarBlockValueKeyByHeight(topCalendarBlockHeight))
    let topBlock = decodeCalendarBlockValue(topCalendarBlockValue)
    return topBlock
  } catch (error) {
    if (error.notFound) {
      return null
    } else {
      let err = `Unable to read top calendar block : ${error.message}`
      throw err
    }
  }
}

async function getCalendarBlockByHeightAsync (blockHeight) {
  try {
    let calendarBlockValue = await db.get(createBinaryCalendarBlockValueKeyByHeight(blockHeight))
    let block = decodeCalendarBlockValue(calendarBlockValue)
    return block
  } catch (error) {
    if (error.notFound) {
      return null
    } else {
      let err = `Unable to read calendar block at height ${blockHeight} : ${error.message}`
      throw err
    }
  }
}

async function getCalendarBlockRangeAsync (startIndex, endIndex) {
  return new Promise((resolve, reject) => {
    let blocks = []
    let minKey = createBinaryCalendarBlockValueKeyByHeight(startIndex)
    let maxKey = createBinaryCalendarBlockValueKeyByHeight(endIndex)
    db.createReadStream({ gte: minKey, lte: maxKey })
      .on('data', (data) => {
        let block = decodeCalendarBlockValue(data)
        blocks.push(block)
      })
      .on('error', (error) => {
        let err = `Error reading calendar blocks for range ${startIndex} to ${endIndex} : ${error.message}`
        return reject(err)
      })
      .on('end', () => {
        return resolve(blocks)
      })
  })
}

async function getCalBlockByDataIdAsync (dataId) {
  try {
    let calendarBlockTypeDataIdIndexValue = await db.get(createBinaryCalendarBlockTypeDataIdIndexKeyByTypeAndDataId('cal', dataId))
    let indexValue = decodeCalendarBlockTypeDataIdIndexValue('cal', calendarBlockTypeDataIdIndexValue)
    return indexValue
  } catch (error) {
    if (error.notFound) {
      return null
    } else {
      let err = `Unable to read calendar cal block index value for dataId ${dataId} : ${error.message}`
      throw err
    }
  }
}

async function getBtcCBlockByDataIdAsync (dataId) {
  try {
    let calendarBlockTypeDataIdIndexValue = await db.get(createBinaryCalendarBlockTypeDataIdIndexKeyByTypeAndDataId('btc-c', dataId))
    let indexValue = decodeCalendarBlockTypeDataIdIndexValue('btc-c', calendarBlockTypeDataIdIndexValue)
    return indexValue
  } catch (error) {
    if (error.notFound) {
      return null
    } else {
      let err = `Unable to read calendar btc-c block index value for dataId ${dataId} : ${error.message}`
      throw err
    }
  }
}

// #endregion CALENDAR FUNCTIONS

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
  let rndBuffer = Buffer.alloc(16, 'ff', 'hex')
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
      .on('data', async (data) => {
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
      .on('error', (error) => {
        let err = `Error reading proof state keys for pruning : ${error.message}`
        return reject(err)
      })
      .on('end', async () => {
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
  let rndBuffer = Buffer.alloc(16, 'ff', 'hex')
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
      .on('data', async (data) => {
        hashesObjects.push(decodeIncomingHashObjectsValue(data.value))
        delOpts.push({ type: 'del', key: data.key })
      })
      .on('error', (error) => {
        let err = `Error reading incoming hashes : ${error.message}`
        return reject(err)
      })
      .on('end', async () => {
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
      .on('data', async (data) => {
        counters.push({
          key: data.key.toString(),
          value: data.value.readDoubleBE()
        })
      })
      .on('error', (error) => {
        let err = `Error reading counter : ${error.message}`
        return reject(err)
      })
      .on('end', async () => {
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
* PUBLIC KEY FUNCTIONS
****************************************************************************************************/
// #region PUBLIC KEY FUNCTIONS

function createBinaryPublicKeyValueKey (pubKeyHash) {
  let hashBuffer = Buffer.from(pubKeyHash, 'hex')
  return Buffer.concat([prefixBuffers.PUBLIC_KEY_VALUE, hashBuffer])
}

function createBinaryPublicKeyValueKeyMin () {
  // generate the minimum key value for range query
  let minBoundsBuffer = Buffer.alloc(6, '00', 'hex')
  return Buffer.concat([prefixBuffers.PUBLIC_KEY_VALUE, minBoundsBuffer])
}

function createBinaryPublicKeyValueKeyMax () {
  // generate the maximum key value for range query
  let maxBoundsBuffer = Buffer.alloc(6, 'ff', 'hex')
  return Buffer.concat([prefixBuffers.PUBLIC_KEY_VALUE, maxBoundsBuffer])
}

async function savePublicKeysAsync (publicKeyItems) {
  let ops = []

  for (let publicKeyItem of publicKeyItems) {
    let publicKeyValueKey = createBinaryPublicKeyValueKey(publicKeyItem.pubKeyHash)
    let publicKeyValue = Buffer.from(publicKeyItem.pubKey, 'base64')
    ops.push({ type: 'put', key: publicKeyValueKey, value: publicKeyValue })
  }

  try {
    await db.batch(ops)
  } catch (error) {
    let err = `Unable to write public keys : ${error.message}`
    throw err
  }
}

async function getAllPublicKeysAsync () {
  return new Promise((resolve, reject) => {
    let results = []
    let minKey = createBinaryPublicKeyValueKeyMin()
    let maxKey = createBinaryPublicKeyValueKeyMax()
    db.createReadStream({ gte: minKey, lte: maxKey })
      .on('data', async (data) => {
        results.push({
          pubKeyHash: data.key.slice(2).toString('hex'),
          pubKey: data.value.toString('base64')
        })
      })
      .on('error', (error) => {
        let err = `Error reading public key values : ${error.message}`
        return reject(err)
      })
      .on('end', () => {
        return resolve(results)
      })
  })
}

// #endregion PUBLIC KEY FUNCTIONS

/****************************************************************************************************
* HMAC KEY FUNCTIONS
****************************************************************************************************/
// #region HMAC KEY FUNCTIONS

function createBinaryHMACKeyValueKey (tntAddress) {
  let addressOnly = tntAddress.slice(2) // remove the preceding '0x'
  let addrBuffer = Buffer.from(addressOnly, 'hex')
  return Buffer.concat([prefixBuffers.HMAC_KEY_VALUE, addrBuffer])
}

function createBinaryHMACKeyValueKeyMin () {
  // generate the minimum key value for range query
  let minBoundsBuffer = Buffer.alloc(32, '00', 'hex')
  return Buffer.concat([prefixBuffers.HMAC_KEY_VALUE, minBoundsBuffer])
}

function createBinaryHMACKeyValueKeyMax () {
  // generate the maximum key value for range query
  let maxBoundsBuffer = Buffer.alloc(32, 'ff', 'hex')
  return Buffer.concat([prefixBuffers.HMAC_KEY_VALUE, maxBoundsBuffer])
}

function encodeHMACKeyValue (hmacKeyItem) {
  let addressOnly = hmacKeyItem.tntAddr.slice(2) // remove the preceding '0x'
  let hmacKeyObj = {
    tntAddr: Buffer.from(addressOnly, 'hex'),
    hmacKey: Buffer.from(hmacKeyItem.hmacKey, 'hex'),
    version: hmacKeyItem.version
  }
  return hmacKeysSchema.encode(hmacKeyObj)
}

function decodeHMACKeyValue (hmacKeyValue) {
  let hmacKeyObj = hmacKeysSchema.decode(hmacKeyValue)
  let hmacKeyItem = {
    tntAddr: `0x${hmacKeyObj.tntAddr.toString('hex')}`,
    hmacKey: hmacKeyObj.hmacKey.toString('hex'),
    version: parseInt(hmacKeyObj.version, 10)
  }
  return hmacKeyItem
}

async function saveHMACKeyAsync (hmacKeyItem) {
  try {
    let hmacKeyValueKey = createBinaryHMACKeyValueKey(hmacKeyItem.tntAddr)
    let hmacKeyValue = encodeHMACKeyValue(hmacKeyItem)
    await db.put(hmacKeyValueKey, hmacKeyValue)
  } catch (error) {
    let err = `Unable to write hmac key : ${error.message}`
    throw err
  }
}

async function getHMACKeyByTNTAddressAsync (tntAddress) {
  let hmacKeyValueKey = createBinaryHMACKeyValueKey(tntAddress)
  try {
    let hmacKeyValue = await db.get(hmacKeyValueKey)
    let hmacKeyItem = decodeHMACKeyValue(hmacKeyValue)
    return hmacKeyItem
  } catch (error) {
    if (error.notFound) {
      return null
    } else {
      let err = `Unable to read hmac key : ${error.message}`
      throw new Error(err)
    }
  }
}

async function getAllHMACKeysAsync () {
  return new Promise((resolve, reject) => {
    let results = []
    let minKey = createBinaryHMACKeyValueKeyMin()
    let maxKey = createBinaryHMACKeyValueKeyMax()
    db.createReadStream({ gte: minKey, lte: maxKey })
      .on('data', async (data) => {
        let hmacKeyItem = decodeHMACKeyValue(data.value)
        results.push(hmacKeyItem)
      })
      .on('error', (error) => {
        let err = `Error reading hmac key values : ${error.message}`
        return reject(err)
      })
      .on('end', () => {
        return resolve(results)
      })
  })
}

// #endregion HMAC KEY FUNCTIONS

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
  getAllPublicKeysAsync: getAllPublicKeysAsync,
  savePublicKeysAsync: savePublicKeysAsync,
  getHMACKeyByTNTAddressAsync: getHMACKeyByTNTAddressAsync,
  saveHMACKeyAsync: saveHMACKeyAsync,
  getAllHMACKeysAsync: getAllHMACKeysAsync,
  saveCalendarBlockBatchAsync: saveCalendarBlockBatchAsync,
  getTopCalendarBlockAsync: getTopCalendarBlockAsync,
  getCalendarBlockByHeightAsync: getCalendarBlockByHeightAsync,
  getCalendarBlockRangeAsync: getCalendarBlockRangeAsync,
  getCalBlockByDataIdAsync: getCalBlockByDataIdAsync,
  getBtcCBlockByDataIdAsync: getBtcCBlockByDataIdAsync,
  setAsync: setAsync,
  getAsync: getAsync
}
