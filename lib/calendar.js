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

const calendarBlock = require('./models/CalendarBlock.js')
const crypto = require('crypto')
const publicKeys = require('./public-keys.js')
const MerkleTools = require('merkle-tools')
const coreHosts = require('./core-hosts.js')
const utils = require('./utils.js')
const Op = calendarBlock.sequelize.Op
const parallel = require('async-await-parallel')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

// TweetNaCl.js
// see: http://ed25519.cr.yp.to
// see: https://github.com/dchest/tweetnacl-js#signatures
const nacl = require('tweetnacl')
nacl.util = require('tweetnacl-util')

// The working set of public keys used to verify block signatures
let publicKeySet = null

// The merkle tools object for building trees and generating proof paths
const merkleTools = new MerkleTools()

// pull in variables defined in shared CalendarBlock module
let CalendarBlock = calendarBlock.CalendarBlock

const BLOCKRANGE_SIZE = 100

// an array of blocks received from Core awaiting validation and write to db
let PENDING_BLOCKS = []
let BLOCKS_RANGED_TO_WRITE = []

// the current height of the local Node calendar
let NODE_TOP_BLOCK = null

async function initNodeTopBlockAsync () {
  let topBlock = await getMostRecentNodeBlockInfoAsync()
  if (topBlock) NODE_TOP_BLOCK = topBlock
  console.log(`INFO : Calendar : Local height is ${NODE_TOP_BLOCK ? NODE_TOP_BLOCK.id : -1}`)
}

// Calculate a deterministic block hash and return a Buffer hash value
let calcBlockHash = (block) => {
  let prefixString = `${block.id.toString()}:${block.time.toString()}:${block.version.toString()}:${block.stackId.toString()}:${block.type.toString()}:${block.dataId.toString()}`
  let prefixBuffer = Buffer.from(prefixString, 'utf8')
  let dataValBuffer = utils.isHex(block.dataVal) ? Buffer.from(block.dataVal, 'hex') : Buffer.from(block.dataVal, 'utf8')
  let prevHashBuffer = Buffer.from(block.prevHash, 'hex')

  return crypto.createHash('sha256').update(Buffer.concat([
    prefixBuffer,
    dataValBuffer,
    prevHashBuffer
  ])).digest()
}

// validate a block's signature given the block hash, signature, and public key
async function validateSignatureAsync (blockHashHex, prefixedSig) {
  let isValidSig
  try {
    let blockHashBytes = nacl.util.decodeUTF8(blockHashHex)
    let prefixedSigValues = prefixedSig.split(':')
    let pubKeyHash = prefixedSigValues[0]
    let sig = prefixedSigValues[1]

    if (!publicKeySet[pubKeyHash]) {
      // the key isnt found in the known set, get latest keys from Core config
      let coreConfig = await coreHosts.getCoreConfigAsync()
      // write new keys to the database
      let newKeys = []
      for (var publicKeyHash in coreConfig.public_keys) {
        if (coreConfig.public_keys.hasOwnProperty(publicKeyHash) && !publicKeySet[publicKeyHash]) {
          newKeys.push({ pubKeyHash: publicKeyHash, pubKey: coreConfig.public_keys[publicKeyHash] })
        }
      }
      await publicKeys.storeConfigPubKeyAsync(newKeys)
      publicKeySet = await publicKeys.getLocalPublicKeysAsync()
      if (!publicKeySet[pubKeyHash]) {
        // the key isnt found in the known set or in the update keys from Core config, return false
        return false
      }
    }
    let signatureBytes = nacl.util.decodeBase64(sig)
    isValidSig = nacl.sign.detached.verify(blockHashBytes, signatureBytes, publicKeySet[pubKeyHash])
  } catch (error) {
    return false
  }
  return isValidSig
}

// read through a batch of blocks and validate their block hashes
async function validateBlocksAsync (lastBlockRead, blocks) {
  if (blocks.length < 1) return
  if (!lastBlockRead) { // the first block must be the genesis block
    let isValidGenesisBlock = true
    let genBlockHashHex = calcBlockHash(blocks[0]).toString('hex')
    if (blocks[0].type !== 'gen') isValidGenesisBlock = false
    if (blocks[0].prevHash !== '0000000000000000000000000000000000000000000000000000000000000000') isValidGenesisBlock = false
    if (blocks[0].hash !== genBlockHashHex) isValidGenesisBlock = false
    if (!isValidGenesisBlock) throw new Error(`Invalid block at height ${blocks[0].id}`)
    lastBlockRead = { hash: '0000000000000000000000000000000000000000000000000000000000000000' }
  }
  // iterate through all blocks, confirming hash values and prevHash values
  for (let x = 0; x < blocks.length; x++) {
    let isValidBlock = true
    let blockHashHex = calcBlockHash(blocks[x]).toString('hex')
    if (blocks[x].hash !== blockHashHex) isValidBlock = false
    if (blocks[x].prevHash !== lastBlockRead.hash) isValidBlock = false
    if (!isValidBlock) throw new Error(`Invalid block at height ${blocks[x].id}`)
    lastBlockRead = blocks[x]
  }
  // confirm the validity of the signature of the last block of the range
  let isValidSig = await validateSignatureAsync(lastBlockRead.hash, lastBlockRead.sig)
  if (!isValidSig) throw new Error(`Invalid signature block at height ${lastBlockRead.id}`)

  return lastBlockRead
}

// write blocks to Node Calendar
async function writeBlocksAsync (blocks) {
  await CalendarBlock.bulkCreate(blocks)
}

// get a range of blocks from the Core Calendar
async function getCoreCalendarBlockRangeAsync (blockRangeIndex) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: `/calendar/blockrange/${blockRangeIndex}`,
    json: true,
    gzip: true,
    timeout: 2000,
    resolveWithFullResponse: true
  }

  let response
  try {
    response = await coreHosts.coreRequestAsync(options, null, true)
  } catch (error) {
    if (error.statusCode) {
      // if the blockrange returns 404, return an empty array for the result
      // result is wrapped in an object because calling function is expecting a response object
      if (error.statusCode === 404) return { blocks: [] }
      throw new Error(`GET Calendar blocks error : Invalid response : ${error.statusCode}`)
    }
    throw new Error(`GET Calendar blocks error : No response`)
  }
  return response
}

async function getMostRecentNodeBlockInfoAsync (showLogging) {
  // get the current height of the Node Calendar
  return CalendarBlock.findOne({ attributes: ['id', 'hash'], order: [['id', 'DESC']] })
}

async function validateNodeCalendarBlocksAsync (showLogging, lastBlockRead) {
  if (showLogging) console.log(`INFO : Calendar : Validating blocks...`)
  const maxBlocksPerDBRequest = 100000
  let startIndex = lastBlockRead ? lastBlockRead.id + 1 : 0
  let endIndex = startIndex + maxBlocksPerDBRequest - 1
  let moreBlocksToRetrieve = true
  // retrieve Calendar blocks from Node Calendar
  while (moreBlocksToRetrieve) {
    // for each batch of Node Calendar blocks received, validate block hashes for each block
    let blocks = await CalendarBlock.findAll({ where: { id: { [Op.between]: [startIndex, endIndex] } }, order: [['id', 'ASC']] })
    if (blocks.length > 0) {
      // some results were found, process them and continue
      lastBlockRead = await validateBlocksAsync(lastBlockRead, blocks)
      if (showLogging) console.log(`INFO : Calendar : Validated ${startIndex} to ${lastBlockRead.id}`)
      startIndex += maxBlocksPerDBRequest
      endIndex += maxBlocksPerDBRequest
    } else {
      // no results found, all Node blocks have been read
      moreBlocksToRetrieve = false
    }
  }
}

async function retrieveAndValidateNewCoreBlocksAsync (coreConfig, rangeSetSize, isPeriodicUpdate) {
  let topBlockId = NODE_TOP_BLOCK ? NODE_TOP_BLOCK.id : -1
  let nextRangeNeededIndex = Math.floor((parseInt(topBlockId) + 1) / BLOCKRANGE_SIZE)
  let lastFullCoreRange = Math.floor(parseInt(coreConfig.calendar.height) / BLOCKRANGE_SIZE) - 1

  let checkNextRangeSet = true
  while (checkNextRangeSet) {
    let rangeError = false
    let blockRangeTasks = []
    for (let x = 0; x < rangeSetSize; x++) {
      let targetRangeIndex = nextRangeNeededIndex + x
      // only request block range from core if it existed at the time of sync startup
      // or if we are checking for new blocks at the calendar update interval
      // this is to prevent initial sync from needlessly overshooting the actual calendar
      // height on Core when requesting batches in large numbers
      if ((targetRangeIndex <= lastFullCoreRange) || isPeriodicUpdate) {
        blockRangeTasks.push(async () => { return getCoreCalendarBlockRangeAsync(targetRangeIndex) })
      }
    }
    let blockRangeResults = []
    if (blockRangeTasks.length > 0) {
      try {
        blockRangeResults = await parallel(blockRangeTasks, rangeSetSize)
      } catch (error) {
        // an error reading the next blockrange occurred, retry operation in 60 seconds
        console.error(`WARN : Calendar : Could not retrieve block range ${nextRangeNeededIndex}${error.statusCode ? ': error ' + error.statusCode : ''}`)
        rangeError = true
        await utils.sleepAsync(60000)
      }
    }
    if (!rangeError) {
      // if any of the results have 0 blocks, or there are no blockRangeTasks
      // to execute, then we have reached the end
      let datafound = false
      for (let x = 0; x < blockRangeResults.length; x++) {
        if (blockRangeResults[x].blocks.length > 0) datafound = true
        if (blockRangeResults[x].blocks.length === 0) checkNextRangeSet = false
      }
      if (datafound) {
        for (let x = 0; x < blockRangeResults.length; x++) {
          let blocks = blockRangeResults[x].blocks
          if (blocks.length === 0) return
          // blockrangeset was found, data has been returned, process it and continue
          let topBlockId = NODE_TOP_BLOCK ? NODE_TOP_BLOCK.id : -1
          while (blocks.length > 0 && blocks[0].id <= topBlockId) {
            // partial block range write may happen if an error occurs, do not try to write the same block twice
            // remove blocks from block range that may have already been written to Node calendar
            blocks.shift()
          }
          PENDING_BLOCKS = PENDING_BLOCKS.concat(blocks)
          nextRangeNeededIndex++
        }
      } else {
        checkNextRangeSet = false
      }
      // if the PENDING_BLOCKS array has reach the write threshold,
      // or if this is the last batch of data, validate and write to db
      if ((PENDING_BLOCKS.length >= (BLOCKRANGE_SIZE * rangeSetSize)) || !checkNextRangeSet) {
        let blocks = PENDING_BLOCKS.splice(0)
        if (blocks.length > 0) {
          let topBlockId = NODE_TOP_BLOCK ? NODE_TOP_BLOCK.id : -1
          let startId = topBlockId + 1
          NODE_TOP_BLOCK = await validateBlocksAsync(NODE_TOP_BLOCK, blocks)
          let endId = NODE_TOP_BLOCK.id
          BLOCKS_RANGED_TO_WRITE.push({
            blocks: blocks,
            startId: startId,
            endId: endId
          })
        }
      }
    }
  }
  // wait until all database write are completed before returning
  let pendingWrites = BLOCKS_RANGED_TO_WRITE.length
  while (pendingWrites > 0) {
    await utils.sleepAsync(100)
    pendingWrites = BLOCKS_RANGED_TO_WRITE.length
  }
}

async function processBlockRangeWriteQueueAsync () {
  while (BLOCKS_RANGED_TO_WRITE.length === 0) {
    await utils.sleepAsync(500)
  }
  while (BLOCKS_RANGED_TO_WRITE.length >= 1) {
    let blocks = BLOCKS_RANGED_TO_WRITE.shift()
    try {
      await writeBlocksAsync(blocks.blocks)
      console.log(`INFO : Calendar : Validated ${blocks.startId} to ${blocks.endId} (New)`)
    } catch (error) {
      console.log(`ERROR : Calendar : Could not write blocks ${blocks.startId} to ${blocks.endId}`)
      process.exit(1)
    }
  }
  setImmediate(() => { processBlockRangeWriteQueueAsync() })
}

// perform a periodic Calendar update check and write new blocks to storage
async function startPeriodicUpdateAsync (coreConfig, ms) {
  try {
    await retrieveAndValidateNewCoreBlocksAsync(coreConfig, 1, true)
  } catch (error) {
    console.error(`ERROR : Calendar : performing update`)
  } finally {
    setTimeout(async () => { await startPeriodicUpdateAsync(coreConfig, ms) }, ms)
  }
}

// perform a periodic validation of the entire Node Calendar
async function startValidateFullNodeAsync (ms) {
  try {
    await validateNodeCalendarBlocksAsync(false, null)
  } catch (error) {
    console.error(`ERROR : Calendar : performing full Calendar validation`)
  } finally {
    setTimeout(async () => { await startValidateFullNodeAsync(ms) }, ms)
  }
}

// perform a periodic validation of the the last 100 blocks of the Node Calendar
async function startValidateRecentNodeAsync (ms) {
  try {
    let offset = 0
    if (NODE_TOP_BLOCK) {
      offset = NODE_TOP_BLOCK.id >= 100 ? 100 : 0
    }
    let prevBlock = await CalendarBlock.findOne({ attributes: ['id', 'hash'], offset: offset, limit: 1, order: [['id', 'DESC']] })
    await validateNodeCalendarBlocksAsync(false, prevBlock)
  } catch (error) {
    console.error(`ERROR : Calendar : performing recent block validation`)
  } finally {
    setTimeout(async () => { await startValidateRecentNodeAsync(ms) }, ms)
  }
}

// perform a periodic calculation to solve the Core audit challenge
async function startCalculateChallengeSolutionAsync (ms) {
  try {
    let coreConfig
    try {
      // retrieve challenge from Core config
      coreConfig = await coreHosts.getCoreConfigAsync()
    } catch (error) {
      if (error.statusCode) throw new Error(`Could not retrieve Core config : ${error.statusCode}`)
      throw error
    }

    let coreChallenge = coreConfig.calendar.audit_challenge
    // parse coreChallenge values
    let coreChallengeSegments = coreChallenge.split(':')
    let challengeCreateTime = parseInt(coreChallengeSegments[0])
    let min = parseInt(coreChallengeSegments[1])
    let max = parseInt(coreChallengeSegments[2])
    let nonce = coreChallengeSegments[3]
    // get challenge blocks from Node Calendar, build challenge merkle tree, get solution
    let nodeChallengeResponse = await calculateChallengeAnswerAsync(min, max, nonce)
    // store solution in redis
    await redis.setAsync('challenge_response', `${challengeCreateTime}:${nodeChallengeResponse}`)
    // console.log(`Core audit challenge solution calculated - ${nodeChallengeResponse}`)
  } catch (error) {
    console.error(`ERROR : Calendar : solving Core audit challenge`)
  } finally {
    setTimeout(async () => { await startCalculateChallengeSolutionAsync(ms) }, ms)
  }
}

async function calculateChallengeAnswerAsync (min, max, nonce) {
  let blocks = await CalendarBlock.findAll({ where: { id: { [Op.between]: [min, max] } }, order: [['id', 'ASC']] })

  merkleTools.resetTree()

  // retrieve all block hashes from blocks array
  let leaves = blocks.map((block) => {
    let blockHashBuffer = Buffer.from(block.hash, 'hex')
    return blockHashBuffer
  })
  // add the nonce to the head of the leaves array
  leaves.unshift(Buffer.from(nonce, 'hex'))

  // Add every hash in leaves to new Merkle tree
  merkleTools.addLeaves(leaves)
  merkleTools.makeTree()

  // calculate the merkle root
  let challengeRoot = merkleTools.getMerkleRoot().toString('hex')

  return challengeRoot
}

// synchronize Node with Core Calendar and validate
async function syncNodeCalendarAsync (isFirstRun, coreConfig, pubKeys) {
  publicKeySet = pubKeys
  await validateNodeCalendarBlocksAsync(isFirstRun)
  processBlockRangeWriteQueueAsync()
  await retrieveAndValidateNewCoreBlocksAsync(coreConfig, 20, false)
}

module.exports = {
  initNodeTopBlockAsync: initNodeTopBlockAsync,
  syncNodeCalendarAsync: syncNodeCalendarAsync,
  startPeriodicUpdateAsync: startPeriodicUpdateAsync,
  startValidateFullNodeAsync: startValidateFullNodeAsync,
  startValidateRecentNodeAsync: startValidateRecentNodeAsync,
  startCalculateChallengeSolutionAsync: startCalculateChallengeSolutionAsync,
  processBlockRangeWriteQueueAsync: processBlockRangeWriteQueueAsync,
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
    redis = redisClient
  }
}
