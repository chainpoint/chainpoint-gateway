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

let coreHosts = require('./core-hosts.js')
const utils = require('./utils.js')

// The object containing the cached Core proof objects
let CORE_PROOF_CACHE = {}

const PRUNE_EXPIRED_INTERVAL_SECONDS = 10

async function getCachedCoreProofsAsync(hashIdCores) {
  // initialize core proof item array with given hash_ids
  let coreProofItems = hashIdCores.map(hashIdCore => {
    return { hash_id: hashIdCore, proof: null }
  })

  // Attempt to read proofs from the cache. Create an array of core proofs
  // retrieved from the cache that map 1:1 in order with the hash_ids in `coreProofItems`.
  // For all proofs that are not found (not cached), return null
  try {
    let cachedCoreProofs = hashIdCores.map(hashIdCore =>
      CORE_PROOF_CACHE[hashIdCore] ? CORE_PROOF_CACHE[hashIdCore].coreProof : null
    )
    // assign the `cachedCoreProofs` results to the corresponding item in `coreProofItems`
    coreProofItems = coreProofItems.map((item, index) => {
      item.proof = cachedCoreProofs[index]
      return item
    })
  } catch (error) {
    console.error(`Cache read error : getCachedCoreProofsAsync : ${error.message}`)
  }

  // Identify the hash_ids for proofs not found already in the cache
  // and attempt to retrieve those proofs from Core
  let nullProofHashIdCores = coreProofItems.filter(item => item.proof === null).map(item => item.hash_id)
  let getProofsFromCoreResults = []
  if (nullProofHashIdCores.length > 0) getProofsFromCoreResults = await getProofsFromCoreAsync(nullProofHashIdCores)

  // construct a final result array from the coreProofItems data and from getProofsFromCoreResults
  let getProofsFromCacheResults = coreProofItems.filter(item => item.proof != null)
  let totalResultsArray = [...getProofsFromCoreResults, ...getProofsFromCacheResults]

  // transform finalResultArray to the return object `finalProofResults`
  // This object is what gets returned by this function
  let finalProofResults = totalResultsArray.map(coreProofItem => {
    if (coreProofItem.proof === null) return { hash_id: coreProofItem.hash_id, proof: null }

    // A proof exists and has been found for this hash_id
    // Identify the anchors completed in this proof and append that information
    let anchorsComplete = utils.parseAnchorsComplete(coreProofItem.proof)
    return {
      hash_id: coreProofItem.hash_id,
      proof: coreProofItem.proof,
      anchorsComplete: anchorsComplete
    }
  })

  // Before we return `finalProofResults`, first look to see which proofs were not
  // cached locally and had to be retrieved from Core. If any exist, cache them now
  if (getProofsFromCoreResults.length > 0) {
    // for all getProofsFromCoreResults, create an proofType lookup object for use in determining
    // proper cache TTL for the proof
    let proofsFromCoreHashIds = getProofsFromCoreResults.map(proofsFromCoreItem => proofsFromCoreItem.hash_id)
    let proofTypeLookup = finalProofResults.reduce((result, finalProofItem) => {
      if (proofsFromCoreHashIds.includes(finalProofItem.hash_id) && finalProofItem.proof) {
        result[finalProofItem.hash_id] = finalProofItem.anchorsComplete.includes('btc') ? 'btc' : 'cal'
        return result
      }
      return result
    }, {})

    // Store the non-null proofs from Core in the local cache for subsequent requests
    // First, create the array of objects to be written to the cache
    let uncachedCoreProofObjects = getProofsFromCoreResults.reduce((result, item) => {
      if (item.proof) {
        result.push({
          hashIdCore: item.hash_id,
          coreProof: item.proof,
          // `cal` cached proofs expire after 15 minutes
          // `btc` cached proofs expire after 25 hours
          expiresAt: Date.now() + (proofTypeLookup[item.hash_id] === 'btc' ? 25 * 60 : 15) * 60 * 1000
        })
      }
      return result
    }, [])

    // Next, attempt to write proofs to cache
    try {
      for (let coreProofObject of uncachedCoreProofObjects) {
        CORE_PROOF_CACHE[coreProofObject.hashIdCore] = {
          coreProof: coreProofObject.coreProof,
          expiresAt: coreProofObject.expiresAt
        }
      }
    } catch (error) {
      console.error(`Cache write error : saveCoreProofsToCacheAsync : ${error.message}`)
    }
  }

  // Finally, return the proof items array
  return finalProofResults
}

async function getProofsFromCoreAsync(hashIdCores) {
  let options = {
    headers: {
      'Content-Type': 'application/json',
      hashids: hashIdCores.join(',')
    },
    method: 'GET',
    uri: '/proofs',
    json: true,
    gzip: true,
    timeout: 5000,
    resolveWithFullResponse: true
  }

  try {
    let coreResponse = await coreHosts.coreRequestAsync(options)
    return coreResponse.body
  } catch (error) {
    if (error.statusCode) throw new Error(`Invalid response on GET proof : ${error.statusCode}`)
    throw new Error('Invalid response received on GET proof')
  }
}

function pruneExpiredItems() {
  let now = Date.now()
  for (let key in CORE_PROOF_CACHE) {
    if (CORE_PROOF_CACHE[key].expiresAt <= now) {
      delete CORE_PROOF_CACHE[key]
    }
  }
}

function startPruneExpiredItemsInterval() {
  return setInterval(pruneExpiredItems, PRUNE_EXPIRED_INTERVAL_SECONDS * 1000)
}

module.exports = {
  getCachedCoreProofsAsync: getCachedCoreProofsAsync,
  startPruneExpiredItemsInterval: startPruneExpiredItemsInterval,
  // additional functions for testing purposes
  pruneExpiredItems: pruneExpiredItems,
  getPruneExpiredIntervalSeconds: () => PRUNE_EXPIRED_INTERVAL_SECONDS,
  getCoreProofCache: () => CORE_PROOF_CACHE,
  setCoreProofCache: obj => {
    CORE_PROOF_CACHE = obj
  },
  setCoreHosts: ch => {
    coreHosts = ch
  }
}
