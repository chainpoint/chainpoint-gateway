const { promisify } = require('util')
const request = require('request')
const calendarBlock = require('./models/CalendarBlock.js')
const crypto = require('crypto')

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

// read through a batch of blocks and validate their block hashes
function validateBlocks (lastBlockRead, blocks) {
  if (blocks.length < 1) return
  if (lastBlockRead === null) { // the first block must be the genesis block
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
  return lastBlockRead
}

// write blocks to local calendar
async function writeBlocksAsync (blocks) {
  await CalendarBlock.bulkCreate(blocks)
}

// get a range of blocks from the global calendar
async function getCalendarBlocksAsync (baseURI, startIndex, endIndex) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: `${baseURI}/calendar/${startIndex}/${endIndex}`,
    json: true,
    gzip: true
  }

  let requestAsync = promisify(request)
  let response = await requestAsync(options)
  if (response.statusCode !== 200) throw new Error('Invalid response')
  return response.body
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

async function validateLocalCalendarBlocksAsync () {
  const maxBlocksPerDBRequest = 100000
  let startIndex = 0
  let endIndex = startIndex + maxBlocksPerDBRequest - 1
  let lastBlockRead = null
  let moreBlocksToRetrieve = true
  // retrieve calendar blocks from local calendar
  while (moreBlocksToRetrieve) {
    // for each batch of local calendar blocks received, validate block hashes for each block
    let blocks = await CalendarBlock.findAll({ where: { id: { $between: [startIndex, endIndex] } }, order: [['id', 'ASC']] })
    if (blocks.length > 0) {
      // some results were found, process them and continue
      lastBlockRead = validateBlocks(lastBlockRead, blocks)
      console.log(`Validated local blocks ${startIndex} to ${lastBlockRead.id}`)
      startIndex += maxBlocksPerDBRequest
      endIndex += maxBlocksPerDBRequest
    } else {
      // no results found, all local blocks have been read
      moreBlocksToRetrieve = false
    }
  }
}

async function retrieveAndValidateNewGlobalBlocksAsync (lastBlockRead, stackConfig) {
  // set startIndex and endIndex to start block range for querying global calendar
  const maxBlocksPerAPIRequest = stackConfig.get_calendar_blocks_max
  let baseURI = stackConfig.chainpoint_base_uri
  let startIndex = lastBlockRead ? lastBlockRead.id + 1 : 0
  let endIndex = startIndex + maxBlocksPerAPIRequest - 1
  let moreBlocksToRetrieve = true
  // retrieve calendar blocks from global calendar greater than local height
  while (moreBlocksToRetrieve) {
    // for each batch of local calendar blocks received, validate block hashes for each block
    let response = await getCalendarBlocksAsync(baseURI, startIndex, endIndex)
    let blocks = response.blocks
    if (blocks.length > 0) {
      // some results were found, process them and continue
      lastBlockRead = validateBlocks(lastBlockRead, blocks)
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

// perform a calendar update check and write new blocks to storage
async function startPeriodicUpdateAsync (stackConfig, ms) {
  try {
    let mostRecentBlockInfo = await getMostRecentLocalBlockInfoAsync(false)
    await retrieveAndValidateNewGlobalBlocksAsync(mostRecentBlockInfo, stackConfig)
    console.log('Calendar is up to date')
  } catch (error) {
    console.error(`Error performing calendar update : ${error.message}`)
  } finally {
    setTimeout(async () => { await startPeriodicUpdateAsync(stackConfig, ms) }, ms)
  }
}

// synchronize with global calendar and validate
async function syncCalendarAsync (isFirstRun, stackConfig) {
  await validateLocalCalendarBlocksAsync()
  let mostRecentBlockInfo = await getMostRecentLocalBlockInfoAsync(isFirstRun)
  await retrieveAndValidateNewGlobalBlocksAsync(mostRecentBlockInfo, stackConfig)
}

module.exports = {
  syncCalendarAsync: syncCalendarAsync,
  startPeriodicUpdateAsync: startPeriodicUpdateAsync
}
