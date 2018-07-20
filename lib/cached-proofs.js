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

const rp = require('request-promise-native')
const utils = require('./utils.js')
const chpBinary = require('chainpoint-binary')

// The custom MIME type for JSON proof array results containing Base64 encoded proof data
const BASE64_MIME_TYPE = 'application/vnd.chainpoint.json+base64'

// The object containing the cached Core proof objects
let CORE_PROOF_DATA = {}

const PRUNE_EXPIRED_INTERVAL_SECONDS = 10

async function getCachedCoreProofsAsync (hashIdCores) {
  let coreProofs = hashIdCores.map((hashIdCore) => { return { hash_id: hashIdCore, proof: null } })

  // attempt to retrieve cached proofs from cache
  try {
    let cacheResults = hashIdCores.map((hashIdCore) => CORE_PROOF_DATA[hashIdCore] ? CORE_PROOF_DATA[hashIdCore].coreProof.toString('base64') : null)
    // assign the cache results to the corresponding item in coreProofs
    coreProofs = coreProofs.map((item, index) => { item.proof = cacheResults[index]; return item })
  } catch (error) {
    console.error(`Cache read error : getCachedCoreProofsAsync : ${error.message}`)
  }

  // for those not found in cache, retrieve from Proof Proxy
  let nullProofHashIdCores = coreProofs.filter((item) => item.proof === null).map((item) => item.hash_id)
  let proofProxyResults = []
  if (nullProofHashIdCores.length > 0) proofProxyResults = await getProofsFromProofProxyAsync(nullProofHashIdCores)

  // construct a final result array from the coreProofs data and from proofProxyResults
  let cachedResults = coreProofs.filter((item) => item.proof != null)
  let finalResultArray = [...proofProxyResults, ...cachedResults]
  // transform finalResultArray to API return object
  // NOTE: this is done here (not by choice) because we need to evaluate the proof content
  // to determine if it is a cal or btc proof. That information is needed now so that
  // we cache the proof for the appropriate amount of time based on proof type.
  // Since we dont want to perform this evaluation multiple times (its a heavy operation), it
  // has been moved here from a later stage of the getProofsByIDV1Async endpoint.
  let finalProofResults = finalResultArray.map((coreProofItem) => {
    if (coreProofItem.proof === null) return { hash_id: coreProofItem.hash_id, proof: null }

    let proofObject
    try {
      proofObject = chpBinary.binaryToObjectSync(coreProofItem.proof)
    } catch (err) {
      return { hash_id: coreProofItem.hash_id, proof: '' }
    }
    // a proof has been returned
    // Identify the anchors completed in this proof
    let anchorsComplete = utils.parseAnchorsComplete(proofObject)
    return { hash_id: coreProofItem.hash_id, proof: proofObject, anchorsComplete: anchorsComplete }
  })

  // for all proof proxy results, create an proofType lookup object for use in determining
  // proper cache TTL for proof
  let proofProxyResultIds = proofProxyResults.map((proofProxyResult) => proofProxyResult.hash_id)
  let proofTypeLookup = finalProofResults.reduce((result, finalProofResult) => {
    if (proofProxyResultIds.includes(finalProofResult.hash_id) && finalProofResult.proof) {
      result[finalProofResult.hash_id] = finalProofResult.anchorsComplete.includes('btc') ? 'btc' : 'cal'
      return result
    }
    return result
  }, {})

  // We've made it this far, so there was no cache hit for some data and requests were made to proof proxy.
  // Store the non-null proof proxy results in cache for next request

  let coreProofObjects = proofProxyResults.reduce((result, item, index) => {
    if (item.proof) {
      result.push({
        hashIdCore: item.hash_id,
        coreProof: item.proof,
        expiresAt: Date.now() + (proofTypeLookup[item.hash_id] === 'btc' ? (25 * 60) : 15) * 60 * 1000
      })
    }
    return result
  }, [])

  // attempt to write proofs to cache
  try {
    for (let coreProofObject of coreProofObjects) {
      CORE_PROOF_DATA[coreProofObject.hashIdCore] = {
        coreProof: Buffer.from(coreProofObject.coreProof, 'base64'),
        expiresAt: coreProofObject.expiresAt
      }
    }
  } catch (error) {
    console.error(`Cache write error : saveCoreProofsToCacheAsync : ${error.message}`)
  }

  return finalProofResults
}

async function getProofsFromProofProxyAsync (hashIdCores) {
  let options = {
    headers: {
      'Accept': BASE64_MIME_TYPE,
      'hashids': hashIdCores.join(','),
      'core': true
    },
    method: 'GET',
    uri: `https://proofs.chainpoint.org/proofs`,
    json: true,
    gzip: true,
    timeout: 5000,
    resolveWithFullResponse: true
  }

  let response
  try {
    let proofProxyResponse = await rp(options)
    response = proofProxyResponse.body
  } catch (error) {
    if (error.statusCode) throw new Error(`Invalid response on GET proof : ${error.statusCode}`)
    throw new Error(`No response received on GET proof`)
  }

  return response
}

function pruneExpiredItems () {
  let now = Date.now()
  for (let key in CORE_PROOF_DATA) {
    if (CORE_PROOF_DATA[key].expiresAt <= now) {
      delete CORE_PROOF_DATA[key]
    }
  }
}

setInterval(pruneExpiredItems, PRUNE_EXPIRED_INTERVAL_SECONDS * 1000)

module.exports = {
  getCachedCoreProofsAsync: getCachedCoreProofsAsync
}
