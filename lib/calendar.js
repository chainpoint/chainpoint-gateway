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
async function validateBlocksAsync (lastBlockRead, blocks, verifySig) {
  if (blocks.length < 1) return
  if (!lastBlockRead) { // the first block must be the genesis block
    let isValidGenesisBlock = true
    let genBlockHashHex = calcBlockHash(blocks[0]).toString('hex')
    if (blocks[0].type !== 'gen') isValidGenesisBlock = false
    if (blocks[0].prevHash !== '0000000000000000000000000000000000000000000000000000000000000000') isValidGenesisBlock = false
    if (blocks[0].hash !== genBlockHashHex) isValidGenesisBlock = false
    if (!isValidGenesisBlock) throw new Error(`Invalid block at height ${blocks[0].id}`)
    if (verifySig) {
      let isValidSig = await validateSignatureAsync(genBlockHashHex, blocks[0].sig)
      if (!isValidSig) throw new Error(`Invalid signature block at height ${blocks[0].id}`)
    }
    lastBlockRead = { hash: '0000000000000000000000000000000000000000000000000000000000000000' }
  }
  // iterate through all blocks, confirming hash values and prevHash values
  for (let x = 0; x < blocks.length; x++) {
    let isValidBlock = true
    let blockHashHex = calcBlockHash(blocks[x]).toString('hex')
    if (blocks[x].hash !== blockHashHex) isValidBlock = false
    if (blocks[x].prevHash !== lastBlockRead.hash) isValidBlock = false
    if (!isValidBlock) throw new Error(`Invalid block at height ${blocks[x].id}`)
    if (verifySig) {
      let isValidSig = await validateSignatureAsync(blockHashHex, blocks[x].sig)
      if (!isValidSig) throw new Error(`Invalid signature block at height ${blocks[x].id}`)
    }
    lastBlockRead = blocks[x]
  }
  return lastBlockRead
}

// write blocks to Node Calendar
async function writeBlocksAsync (blocks) {
  await CalendarBlock.bulkCreate(blocks)
}

// get a range of blocks from the Core Calendar
async function getCoreCalendarBlocksAsync (startIndex, endIndex) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: `/calendar/${startIndex}/${endIndex}`,
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let response
  try {
    response = await coreHosts.coreRequestAsync(options)
  } catch (error) {
    if (error.statusCode) throw new Error(`GET Calendar blocks error : Invalid response : ${error.statusCode}`)
    throw new Error(`GET Calendar blocks error : No response`)
  }
  return response
}

async function getMostRecentNodeBlockInfoAsync (showLogging) {
  // get the current height of the Node Calendar
  if (showLogging) console.log(`Retrieving Node Calendar most recent block info`)
  let mostRecentBlockInfo = await CalendarBlock.findOne({ attributes: ['id', 'hash'], order: [['id', 'DESC']] })
  if (!mostRecentBlockInfo) {
    if (showLogging) console.log(`Node Calendar is empty`)
    return null
  }
  if (showLogging) console.log(`Node Calendar height = ${mostRecentBlockInfo.id}`)
  return mostRecentBlockInfo
}

async function validateNodeCalendarBlocksAsync (showLogging, lastBlockRead) {
  if (showLogging) console.log(`Validating Node Calendar blocks...`)
  const maxBlocksPerDBRequest = 100000
  let startIndex = lastBlockRead ? lastBlockRead.id + 1 : 0
  let endIndex = startIndex + maxBlocksPerDBRequest - 1
  let moreBlocksToRetrieve = true
  // retrieve Calendar blocks from Node Calendar
  while (moreBlocksToRetrieve) {
    // for each batch of Node Calendar blocks received, validate block hashes for each block
    let blocks = await CalendarBlock.findAll({ where: { id: { $between: [startIndex, endIndex] } }, order: [['id', 'ASC']] })
    if (blocks.length > 0) {
      // some results were found, process them and continue
      lastBlockRead = await validateBlocksAsync(lastBlockRead, blocks, false)
      if (showLogging) console.log(`Validated Node Calendar blocks ${startIndex} to ${lastBlockRead.id}`)
      startIndex += maxBlocksPerDBRequest
      endIndex += maxBlocksPerDBRequest
    } else {
      // no results found, all Node blocks have been read
      moreBlocksToRetrieve = false
    }
  }
}

async function retrieveAndValidateNewCoreBlocksAsync (lastBlockRead, coreConfig) {
  // set startIndex and endIndex to start block range for querying Core calendar
  const maxBlocksPerAPIRequest = coreConfig.get_calendar_blocks_max
  let startIndex = lastBlockRead ? lastBlockRead.id + 1 : 0
  let endIndex = startIndex + maxBlocksPerAPIRequest - 1
  let moreBlocksToRetrieve = true
  // retrieve Calendar blocks from Core Calendar greater than Node height
  while (moreBlocksToRetrieve) {
    // for each batch of Core Calendar blocks received, validate block hashes for each block
    let response = await getCoreCalendarBlocksAsync(startIndex, endIndex)
    let blocks = response.blocks
    if (blocks.length > 0) {
      // some results were found, process them and continue
      lastBlockRead = await validateBlocksAsync(lastBlockRead, blocks, true)
      await writeBlocksAsync(blocks)
      console.log(`Validated and stored Core blocks ${startIndex} to ${lastBlockRead.id}`)
      startIndex += maxBlocksPerAPIRequest
      endIndex += maxBlocksPerAPIRequest
    } else {
      // no results found, all Core blocks have been read
      moreBlocksToRetrieve = false
    }
  }
}

// perform a periodic Calendar update check and write new blocks to storage
async function startPeriodicUpdateAsync (coreConfig, ms) {
  setInterval(async () => {
    try {
      let mostRecentBlockInfo = await getMostRecentNodeBlockInfoAsync(false)
      await retrieveAndValidateNewCoreBlocksAsync(mostRecentBlockInfo, coreConfig)
    } catch (error) {
      console.error(`Error performing Calendar update`)
    }
  }, ms)
}

// perform a periodic validation of the entire Node Calendar
async function startValidateFullNodeAsync (ms) {
  try {
    await validateNodeCalendarBlocksAsync(false, null)
  } catch (error) {
    console.error(`Error performing full Calendar block validation`)
  } finally {
    setTimeout(async () => { await startValidateFullNodeAsync(ms) }, ms)
  }
}

// perform a periodic validation of the the last 100 blocks of the Node Calendar
async function startValidateRecentNodeAsync (ms) {
  try {
    let mostRecentBlockInfo = await getMostRecentNodeBlockInfoAsync(false)
    let offset = 0
    if (mostRecentBlockInfo) {
      offset = mostRecentBlockInfo.id >= 100 ? 100 : 0
    }
    let prevBlock = await CalendarBlock.findOne({ attributes: ['id', 'hash'], offset: offset, limit: 1, order: [['id', 'DESC']] })
    await validateNodeCalendarBlocksAsync(false, prevBlock)
  } catch (error) {
    console.error(`Error performing recent Calendar block validation`)
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
      if (error.statusCode) throw new Error(`Error retrieving Core config : ${error.statusCode}`)
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
    console.log(`Core audit challenge solution calculated - ${nodeChallengeResponse}`)
  } catch (error) {
    console.error(`Error solving Core audit challenge`)
  } finally {
    setTimeout(async () => { await startCalculateChallengeSolutionAsync(ms) }, ms)
  }
}

async function calculateChallengeAnswerAsync (min, max, nonce) {
  let blocks = await CalendarBlock.findAll({ where: { id: { $between: [min, max] } }, order: [['id', 'ASC']] })

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
  let mostRecentBlockInfo = await getMostRecentNodeBlockInfoAsync(isFirstRun)
  await retrieveAndValidateNewCoreBlocksAsync(mostRecentBlockInfo, coreConfig)
}

module.exports = {
  syncNodeCalendarAsync: syncNodeCalendarAsync,
  startPeriodicUpdateAsync: startPeriodicUpdateAsync,
  startValidateFullNodeAsync: startValidateFullNodeAsync,
  startValidateRecentNodeAsync: startValidateRecentNodeAsync,
  startCalculateChallengeSolutionAsync: startCalculateChallengeSolutionAsync,
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
    redis = redisClient
  }
}
