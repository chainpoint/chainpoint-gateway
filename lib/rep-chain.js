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

const crypto = require('crypto')
const ethers = require('ethers')
let cores = require('./cores.js')
let rocksDB = require('./models/RocksDB.js')
let env = require('./parse-env.js').env
let rp = require('request-promise-native')
let utils = require('./utils.js')

// the reputation generation frequency, in minutes
// this should be the same as Core's audit interval
const REP_INTERVAL_MINUTES = 30

// boolean indicating is `generateReputationEntryAsync` is currently running
let REP_GEN_IN_PROGRESS = false

async function generateReputationEntryAsync() {
  try {
    // start creating the new reputation item using current reputation and calendar state
    let newRepItem = await initializeNewRepItemAsync()
    console.log(`INFO : Reputation : Generating new item with id ${newRepItem.id}`)

    // submit previous reputation item hash to this Node and receive
    // the CAL proof's hash id for inclusion in the new reputation item
    // and the hint as to when to retrieve the CAL proof
    let submitResult = await submitHashToSelfAsync(newRepItem.prevRepItemHash)

    // wait until cal proof should be ready
    let hintTime = new Date(submitResult.calHint).getTime()
    let delayMS = hintTime - Date.now()
    await utils.sleepAsync(delayMS)
    // retrieve and store the CAL proof
    await retrieveAndStoreProofAsync(newRepItem.id, submitResult.hashIdNode)

    // add `hashIdNode` to the main `newRepItem` object
    newRepItem = Object.assign(newRepItem, { hashIdNode: submitResult.hashIdNode })
    // generate the hash of this object
    let repItemHash = calculateReputationItemHash(newRepItem)
    // generate a signature for this object over its hash
    let signature = await calculateReputationItemSignatureAsync(repItemHash)
    // add `repItemHash` and `signature` to the main `newRepItem` object
    newRepItem = Object.assign(newRepItem, { repItemHash, signature })

    // save this new reputation item
    await rocksDB.saveReputationItemAsync(newRepItem)

    console.log(`INFO : Reputation : Successfully added new item with id ${newRepItem.id}`)
  } catch (error) {
    console.error(`ERROR : Could not create reputation item : ${error}`)
  }
}

async function initializeNewRepItemAsync() {
  let latestCalBlockInfo = await cores.getLatestCalBlockInfoAsync()
  let mostRecentReputationItemAsync = await rocksDB.getMostRecentReputationItemAsync()

  // If there is no recent reputation item, this miust be the first,
  // set id to 0 and previous hash to all zeros
  let newId = mostRecentReputationItemAsync ? mostRecentReputationItemAsync.id + 1 : 0
  let calBlockHeight = parseInt(latestCalBlockInfo.latest_block_height) || 0
  let prevRepItemHash = mostRecentReputationItemAsync
    ? mostRecentReputationItemAsync.repItemHash
    : '0000000000000000000000000000000000000000000000000000000000000000'

  // create the new reputation item object
  let newRepItem = {
    id: newId,
    calBlockHeight: calBlockHeight,
    calBlockHash: latestCalBlockInfo.latest_block_hash,
    prevRepItemHash: prevRepItemHash
  }

  return newRepItem
}

async function submitHashToSelfAsync(hash) {
  let options = {
    method: 'POST',
    uri: `http://127.0.0.1:${env.HTTP_PORT}/hashes`,
    body: {
      hashes: [hash]
    },
    gzip: true,
    json: true,
    timeout: 1000
  }

  let response
  try {
    response = await rp(options)
  } catch (error) {
    throw 'Unable to make POST request to self'
  }

  let result
  try {
    result = {
      hashIdNode: response.hashes[0].hash_id_node,
      calHint: response.meta.processing_hints.cal
    }
  } catch (error) {
    throw 'Bad response received from POST request to self'
  }

  return result
}

async function retrieveAndStoreProofAsync(repId, hashIdNode) {
  let options = {
    headers: { Accept: 'application/vnd.chainpoint.ld+json' },
    method: 'GET',
    uri: `http://127.0.0.1:${env.HTTP_PORT}/proofs/${hashIdNode}`,
    gzip: true,
    json: true,
    timeout: 1000
  }

  let proof = null

  // attempt to retrieve the proof, retrying up to 5 times if null
  for (let i = 0; i < 5; i++) {
    let response
    try {
      response = await rp(options)
    } catch (error) {
      throw 'Unable to make GET request to self'
    }
    proof = response[0].proof
    if (proof) break
    // pause 5 seconds and try again
    await utils.sleepAsync(5000)
    console.log(`INFO : Reputation : Retrying proof retrieval for id ${hashIdNode}`)
  }

  if (proof === null) throw `Unable to retrieve proof for id ${hashIdNode}`

  // convert the proof JSON object to a string
  proof = JSON.stringify(proof)

  try {
    // save this new proof
    await rocksDB.saveReputationItemProofAsync(repId, proof)
  } catch (error) {
    throw `Unable to store proof for hashIdNode ${hashIdNode} at id ${repId}`
  }
}

// Calculate a deterministic reputation item hash and return a Buffer hash value
function calculateReputationItemHash(repItem) {
  let idBytes = Buffer.alloc(4)
  idBytes.writeUInt32BE(repItem.id)
  let calBlockHeightBytes = Buffer.alloc(4)
  calBlockHeightBytes.writeUInt32BE(repItem.calBlockHeight)
  let calBlockHashBytes = Buffer.from(repItem.calBlockHash, 'hex')
  let prevRepItemHashBytes = Buffer.from(repItem.prevRepItemHash, 'hex')
  let hashIdNodeBytes = Buffer.from(repItem.hashIdNode.replace(/-/g, ''), 'hex')

  return crypto
    .createHash('sha256')
    .update(Buffer.concat([idBytes, calBlockHeightBytes, calBlockHashBytes, prevRepItemHashBytes, hashIdNodeBytes]))
    .digest('hex')
}

// Calculate a base64 encoded signature of the reputation item hash
async function calculateReputationItemSignatureAsync(repItemHash) {
  let wallet = new ethers.Wallet(env.NODE_ETH_PRIVATE_KEY)
  // generate the signature for the binary representation of `repItemHash`
  let sig = await wallet.signMessage(Buffer.from(repItemHash, 'hex'))
  return sig
}

function startRepInterval() {
  // never allow `generateReputationEntryAsync` to run more than once at a time
  return setInterval(async () => {
    if (!REP_GEN_IN_PROGRESS) {
      REP_GEN_IN_PROGRESS = true
      await generateReputationEntryAsync()
      REP_GEN_IN_PROGRESS = false
    }
  }, REP_INTERVAL_MINUTES * 60 * 1000)
}

module.exports = {
  startRepInterval: startRepInterval,
  generateReputationEntryAsync: generateReputationEntryAsync,
  // additional functions for testing purposes
  initializeNewRepItemAsync: initializeNewRepItemAsync,
  submitHashToSelfAsync: submitHashToSelfAsync,
  retrieveAndStoreProofAsync: retrieveAndStoreProofAsync,
  calculateReputationItemHash: calculateReputationItemHash,
  calculateReputationItemSignatureAsync: calculateReputationItemSignatureAsync,
  setRocksDB: db => {
    rocksDB = db
  },
  setCores: c => {
    cores = c
  },
  setENV: obj => {
    env = obj
  },
  setRP: RP => {
    rp = RP
  }
}
