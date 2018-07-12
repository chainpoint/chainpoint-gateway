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
  maxFileSize: 2 * 1024 * 1024
}

const db = level(path.resolve('./nodedb'), opts)

const PROOF_STATE_INDEX_PREFIX = 'ps~idx~'
const PROOF_STATE_VALUE_PREFIX = 'ps~val~'
const PRUNE_BATCH_SIZE = 1000
let PRUNE_IN_PROGRESS = false

async function getProofStateByHashIdNodeAsync (hashIdNode) {
  let hashIdKey = `${PROOF_STATE_VALUE_PREFIX}${hashIdNode}`
  try {
    let nodeProofDataItem = await db.get(hashIdKey)
    return JSON.parse(nodeProofDataItem)
  } catch (error) {
    if (error.notFound) {
      return {
        hashIdNode: hashIdNode,
        hash: null,
        proofState: null,
        hashIdCore: null
      }
    } else {
      let err = `Unable to read proof state for hash with hashIdNode = ${hashIdNode} : ${error.message}`
      throw err
    }
  }
}

async function getProofStateByHashIdNodeBatchAsync (hashIdNodes) {
  let results = []
  for (let hashIdNode of hashIdNodes) {
    try {
      let hashIdKey = `${PROOF_STATE_VALUE_PREFIX}${hashIdNode}`
      let nodeProofDataItem = await db.get(hashIdKey)
      results.push(JSON.parse(nodeProofDataItem))
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

async function saveProofStateAsync (nodeProofDataItem) {
  let hashIdKey = `${PROOF_STATE_VALUE_PREFIX}${nodeProofDataItem.hashIdNode}`

  let ops = []
  ops.push({ type: 'put', key: hashIdKey, value: JSON.stringify(nodeProofDataItem) })
  ops.push({ type: 'put', key: `${PROOF_STATE_INDEX_PREFIX}${Date.now()}${crypto.randomBytes(16).toString('hex')}`, value: hashIdKey })

  try {
    await db.batch(ops)
  } catch (error) {
    let err = `Unable to write proof state : ${error.message}`
    throw err
  }
}

async function saveProofStateBatchAsync (nodeProofDataItems) {
  let ops = []

  for (let nodeProofDataItem of nodeProofDataItems) {
    let hashIdKey = `${PROOF_STATE_VALUE_PREFIX}${nodeProofDataItem.hashIdNode}`
    ops.push({ type: 'put', key: hashIdKey, value: JSON.stringify(nodeProofDataItem) })
    ops.push({ type: 'put', key: `${PROOF_STATE_INDEX_PREFIX}${Date.now()}${crypto.randomBytes(16).toString('hex')}`, value: hashIdKey })
  }

  try {
    await db.batch(ops)
  } catch (error) {
    let err = `Unable to write proof state : ${error.message}`
    throw err
  }
}

async function pruneProofStateDataSince (timestampMS) {
  if (!PRUNE_IN_PROGRESS) {
    PRUNE_IN_PROGRESS = true
    return new Promise((resolve, reject) => {
      let ops = []
      db.createReadStream({ gt: `${PROOF_STATE_INDEX_PREFIX}${'0'.repeat(45)}`, lte: `${PROOF_STATE_INDEX_PREFIX}${timestampMS}${'~'.repeat(32)}` })
        .on('data', async function (data) {
          // Prefixed UNIX Timestamp w/ milliseconds
          let psIdxRegex = new RegExp(`^${PROOF_STATE_INDEX_PREFIX}[0-9]{13}[0-9a-f]{32}$`, 'i')
          if (data.key.match(psIdxRegex)) {
            let ts = data.key.split('~')[2].substr(0, 13)
            if (parseInt(ts) <= timestampMS) {
              ops.push({ type: 'del', key: data.key })
              ops.push({ type: 'del', key: data.value })
            } else {
              console.error(`ERROR : The selected key ${data.key} is not an Integer less than or equal to ${timestampMS}`)
            }
          } else {
            console.error(`ERROR : The selected key ${data.key} is not a prefixed UNIX timestamp!`)
          }
          // Execute in batches of PRUNE_BATCH_SIZE
          if (ops.length >= PRUNE_BATCH_SIZE) {
            try {
              let delOps = ops.splice(0)
              await db.batch(delOps)
            } catch (error) {
              PRUNE_IN_PROGRESS = false
              return reject(error)
            }
          }
        })
        .on('error', function (error) {
          let err = `Error reading keys for pruning : ${error.message}`
          return reject(err)
        })
        .on('end', async function () {
          try {
            await db.batch(ops)
          } catch (error) {
            PRUNE_IN_PROGRESS = false
            return reject(error)
          }
        })
    })
  }
}

module.exports = {
  getProofStateByHashIdNodeAsync: getProofStateByHashIdNodeAsync,
  getProofStateByHashIdNodeBatchAsync: getProofStateByHashIdNodeBatchAsync,
  saveProofStateAsync: saveProofStateAsync,
  saveProofStateBatchAsync: saveProofStateBatchAsync,
  pruneProofStateDataSince
}
