const calendarBlock = require('./models/CalendarBlock.js')
const crypto = require('crypto')
const publicKeys = require('./public-keys.js')
const MerkleTools = require('merkle-tools')
const coreHosts = require('./core-hosts.js')

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
  let dataValBuffer = Buffer.from(block.dataVal, 'hex')
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

// write blocks to local calendar
async function writeBlocksAsync (blocks) {
  await CalendarBlock.bulkCreate(blocks)
}

// get a range of blocks from the global calendar
async function getCalendarBlocksAsync (startIndex, endIndex) {
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
    if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.message}`)
    throw new Error(`No response received on GET calendar blocks : ${error.message}`)
  }
  return response
}

async function getMostRecentLocalBlockInfoAsync (showLogging) {
  // get the current height of the local calendar
  if (showLogging) console.log(`Retrieving local calendar most recent block info`)
  let mostRecentBlockInfo = await CalendarBlock.findOne({ attributes: ['id', 'hash'], order: [['id', 'DESC']] })
  if (!mostRecentBlockInfo) {
    if (showLogging) console.log(`Local calendar is empty`)
    return null
  }
  if (showLogging) console.log(`Local calendar height = ${mostRecentBlockInfo.id}`)
  return mostRecentBlockInfo
}

async function validateLocalCalendarBlocksAsync (showLogging, lastBlockRead) {
  if (showLogging) console.log(`Validating local blocks calendar blocks...`)
  const maxBlocksPerDBRequest = 100000
  let startIndex = lastBlockRead ? lastBlockRead.id + 1 : 0
  let endIndex = startIndex + maxBlocksPerDBRequest - 1
  let moreBlocksToRetrieve = true
  // retrieve calendar blocks from local calendar
  while (moreBlocksToRetrieve) {
    // for each batch of local calendar blocks received, validate block hashes for each block
    let blocks = await CalendarBlock.findAll({ where: { id: { $between: [startIndex, endIndex] } }, order: [['id', 'ASC']] })
    if (blocks.length > 0) {
      // some results were found, process them and continue
      lastBlockRead = await validateBlocksAsync(lastBlockRead, blocks, false)
      if (showLogging) console.log(`Validated local blocks ${startIndex} to ${lastBlockRead.id}`)
      startIndex += maxBlocksPerDBRequest
      endIndex += maxBlocksPerDBRequest
    } else {
      // no results found, all local blocks have been read
      moreBlocksToRetrieve = false
    }
  }
}

async function retrieveAndValidateNewGlobalBlocksAsync (lastBlockRead, coreConfig) {
  // set startIndex and endIndex to start block range for querying global calendar
  const maxBlocksPerAPIRequest = coreConfig.get_calendar_blocks_max
  let startIndex = lastBlockRead ? lastBlockRead.id + 1 : 0
  let endIndex = startIndex + maxBlocksPerAPIRequest - 1
  let moreBlocksToRetrieve = true
  // retrieve calendar blocks from global calendar greater than local height
  while (moreBlocksToRetrieve) {
    // for each batch of local calendar blocks received, validate block hashes for each block
    let response = await getCalendarBlocksAsync(startIndex, endIndex)
    let blocks = response.blocks
    if (blocks.length > 0) {
      // some results were found, process them and continue
      lastBlockRead = await validateBlocksAsync(lastBlockRead, blocks, true)
      await writeBlocksAsync(blocks)
      console.log(`Validated and stored global blocks ${startIndex} to ${lastBlockRead.id}`)
      startIndex += maxBlocksPerAPIRequest
      endIndex += maxBlocksPerAPIRequest
    } else {
      // no results found, all local blocks have been read
      moreBlocksToRetrieve = false
    }
  }
}

// perform a periodic calendar update check and write new blocks to storage
async function startPeriodicUpdateAsync (coreConfig, ms) {
  try {
    let mostRecentBlockInfo = await getMostRecentLocalBlockInfoAsync(false)
    await retrieveAndValidateNewGlobalBlocksAsync(mostRecentBlockInfo, coreConfig)
  } catch (error) {
    console.error(`Error performing calendar update : ${error.message}`)
  } finally {
    setTimeout(async () => { await startPeriodicUpdateAsync(coreConfig, ms) }, ms)
  }
}

// perform a periodic audit of the entire local calendar
async function startAuditLocalFullAsync (ms) {
  try {
    await validateLocalCalendarBlocksAsync(false, null)
    console.log('Calendar full audit succeeded')
  } catch (error) {
    console.error(`Error performing calendar full audit : ${error.message}`)
  } finally {
    setTimeout(async () => { await startAuditLocalFullAsync(ms) }, ms)
  }
}

// perform a periodic audit of the the last 100 blocks of local calendar
async function startAuditLocalRecentAsync (ms) {
  try {
    let mostRecentBlockInfo = await getMostRecentLocalBlockInfoAsync(false)
    let offset = mostRecentBlockInfo.id >= 100 ? 100 : 0
    let prevBlock = await CalendarBlock.findOne({ attributes: ['id', 'hash'], offset: offset, limit: 1, order: [['id', 'DESC']] })
    await validateLocalCalendarBlocksAsync(false, prevBlock)
    console.log('Calendar recent audit succeeded')
  } catch (error) {
    console.error(`Error performing calendar recent audit : ${error.message}`)
  } finally {
    setTimeout(async () => { await startAuditLocalRecentAsync(ms) }, ms)
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
      if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.message}`)
      throw error
    }
    let coreChallenge = coreConfig.calendar.audit_challenge
    // parse coreChallenge values
    let coreChallengeSegments = coreChallenge.split(':')
    let challengeCreateTime = parseInt(coreChallengeSegments[0])
    let min = parseInt(coreChallengeSegments[1])
    let max = parseInt(coreChallengeSegments[2])
    let nonce = coreChallengeSegments[3]
    // get challenge blocks from local Calendar, build challenge merkle tree, get solution
    let nodeChallengeResponse = await calculateChallengeAnswerAsync(min, max, nonce)
    // store solution in redis
    await redis.setAsync('challenge_response', `${challengeCreateTime}:${nodeChallengeResponse}`)
    console.log(`Core audit challenge solution calculated - ${nodeChallengeResponse}`)
  } catch (error) {
    console.error(`Error solving the Core audit challenge : ${error.message}`)
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

// synchronize with global calendar and validate
async function syncCalendarAsync (isFirstRun, coreConfig, pubKeys) {
  publicKeySet = pubKeys
  await validateLocalCalendarBlocksAsync(isFirstRun)
  let mostRecentBlockInfo = await getMostRecentLocalBlockInfoAsync(isFirstRun)
  await retrieveAndValidateNewGlobalBlocksAsync(mostRecentBlockInfo, coreConfig)
}

module.exports = {
  syncCalendarAsync: syncCalendarAsync,
  startPeriodicUpdateAsync: startPeriodicUpdateAsync,
  startAuditLocalFullAsync: startAuditLocalFullAsync,
  startAuditLocalRecentAsync: startAuditLocalRecentAsync,
  startCalculateChallengeSolutionAsync: startCalculateChallengeSolutionAsync,
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
    redis = redisClient
  }
}
