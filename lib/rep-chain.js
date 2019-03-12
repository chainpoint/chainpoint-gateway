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
let cores = require('./cores.js')
let rocksDB = require('./models/RocksDB.js')
let env = require('./parse-env.js').env
const nacl = require('tweetnacl')
nacl.util = require('tweetnacl-util')

// the reputation generation frequency, in minutes
// this should be the same as Core's audit interval
const REP_INTERVAL_MINUTES = 30

async function generateReputationEntryAsync() {
  try {
    let latestCalBlockInfo = await cores.getLatestCalBlockInfoAsync()
    let mostRecentReputationItemAsync = await rocksDB.getMostRecentReputationItemAsync()

    // If there is no recent reputation item, this miust be the first,
    // set id to 0 and previous hash to all zeros
    let newId = mostRecentReputationItemAsync ? mostRecentReputationItemAsync.id + 1 : 0
    let calBlockHeight = parseInt(latestCalBlockInfo.latest_block_height) || 0
    let prevRepItemHash = mostRecentReputationItemAsync
      ? mostRecentReputationItemAsync.repItemHash
      : '0000000000000000000000000000000000000000000000000000000000000000'

    // submit `prevRepItemHash` and await a CAL proof
    // save the CAL proof's hash id for includion in the new reputation item
    let hashIdNode = '' // TODO: Submit hash, get UUID

    // store the CAL proof

    // create the new reputation item object
    let newRepItem = {
      id: newId,
      calBlockHeight: calBlockHeight,
      calBlockHash: latestCalBlockInfo.latest_block_hash,
      prevRepItemHash: prevRepItemHash,
      hashIdNode: hashIdNode
    }
    // generate the hash of this object
    let repItemHash = calculateReputationItemHash(newRepItem)
    // generate a signature for this object over its hash
    let signature = calculateReputationItemSignature(repItemHash)

    // add `repItemHash` and `signature` to the main `newRepItem` object
    newRepItem = Object.assign(newRepItem, { repItemHash, signature })

    // save this new reputation item
    await rocksDB.saveReputationItemAsync(newRepItem)

    console.log(`INFO : Reputation : Added new item with height ${newRepItem.id}`)
  } catch (error) {
    console.error(`ERROR : Could not create reputation item : ${error}`)
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
function calculateReputationItemSignature(repItemHash) {
  // TODO: Test this with ETH keypair... will tweetnacl work in this case? replace if not
  const signingPKBytes = nacl.util.decodeBase64(env.NODE_ADDRESS_PK)
  const signingKeypair = nacl.sign.keyPair.fromSecretKey(signingPKBytes)
  return nacl.util.encodeBase64(nacl.sign.detached(nacl.util.decodeUTF8(repItemHash), signingKeypair.secretKey))
}

function startRepInterval() {
  return setInterval(generateReputationEntryAsync, REP_INTERVAL_MINUTES * 60 * 1000)
}

setTimeout(() => {
  generateReputationEntryAsync()
}, 5000)

module.exports = {
  startRepInterval: startRepInterval,
  // additional functions for testing purposes
  setRocksDB: db => {
    rocksDB = db
  },
  setCores: c => {
    cores = c
  }
}
