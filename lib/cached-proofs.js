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

let cores = require('./cores.js')
const utils = require('./utils.js')
const _ = require('lodash')

// The object containing the cached Core proof objects
let CORE_PROOF_CACHE = {}

const PRUNE_EXPIRED_INTERVAL_SECONDS = 10

async function getCachedCoreProofsAsync(coreSubmissions) {
  // create `hashIdCore` to `submitId` lookup object, keyed by `hashIdCore`
  let submitIdForHashIdCoreLookup = coreSubmissions.reduce((result, item) => {
    for (let core of item.cores) {
      result[core.hashIdCore] = item.submitId
    }
    return result
  }, {})

  // determine max core submission count for these submissions... the largest cores array of all submissions
  // this will be constant under normal usage, only varying if the master submission count is updated
  let maxCoreSubmissionCount = coreSubmissions.reduce((result, item) => {
    if (item.cores.length > result) result = item.cores.length
    return result
  }, 0)

  // convert `coreSubmissions` array to an object keyed by the `submitId`
  coreSubmissions = coreSubmissions.reduce((result, item) => {
    result[item.submitId] = { cores: item.cores, proof: undefined }
    return result
  }, {})

  // Attempt to read proofs from the cache.
  // For all proofs that are not found (not cached), keep `proof` value as undefined
  for (let submitId in coreSubmissions) {
    coreSubmissions[submitId].proof = CORE_PROOF_CACHE[submitId] ? CORE_PROOF_CACHE[submitId].coreProof : undefined
  }

  console.log('coreSubmissions')
  console.log(coreSubmissions)
  // loop through the 1st, 2nd, ... cores array object for each submission until all proofs have been returned
  // under normal operation, with all Cores operating as expected, only one iteration will be performed
  // if a Core is offline, the second iterations with attempt to request proofs from the second IP/HashIdCore pair
  // iterations will cotinue until all values have been retrieved, or all IP/HashIdCore pairs have been attempted
  //
  // use `newProofSubmitIds` to keep track of the submitIds that have new proof data returned from Core
  // this information is used later to determine what new data needs to be cached
  let newProofSubmitIds = []
  for (let index = 0; index < maxCoreSubmissionCount; index++) {
    // find core submissions that have `undefined` proofs, they will be requested from Core at cores index `index`
    let undefinedProofSubmissions = Object.keys(coreSubmissions).reduce((result, submitId) => {
      let coreInfo = coreSubmissions[submitId].cores[index]
      // if the proof is undefined, and Core info exists in this submission for this `index`, add to results
      if (coreSubmissions[submitId].proof === undefined && coreInfo) {
        result.push({ submitId: submitId, ip: coreInfo.ip, hashIdCore: coreInfo.hashIdCore })
      }
      return result
    }, [])
    console.log('undefinedProofSubmissions')
    console.log(undefinedProofSubmissions)
    // if none were found, then we have received proof data for all requested submissions, exit loop
    if (undefinedProofSubmissions.length === 0) break

    // split `undefinedProofSubmissions` into distinct array by unique Core IP
    // this is needed so that we may request proofs from Core in batches grouped by Core IP
    // start by determining all the unique IPs in play in undefinedProofSubmissions
    let uniqueIPs = undefinedProofSubmissions.reduce((result, item) => {
      // using unshift to build list in reverse for efficiency because we must iterate in reverse later
      if (!result.includes(item.ip)) result.unshift(item.ip)
      return result
    }, [])
    console.log('uniqueIPs')
    console.log(uniqueIPs)
    // build an array of submissions for each unique Core IP found
    let submissionsGroupByIPs = []
    for (let ip of uniqueIPs) {
      let result = []
      for (let x = undefinedProofSubmissions.length - 1; x >= 0; x--) {
        if (undefinedProofSubmissions[x].ip === ip) result.push(...undefinedProofSubmissions.splice(x, 1))
      }
      submissionsGroupByIPs.push(result)
    }
    console.log('submissionsGroupByIPs')
    console.log(submissionsGroupByIPs)

    // for each resulting submission group array, request the proofs from Core
    for (let submissionsGroup of submissionsGroupByIPs) {
      // flatten the submission data for use in the getProofsAsync call
      let flattenedSubmission = submissionsGroup.reduce(
        (result, item) => {
          result.ip = item.ip // need to make the setting only once, but will be the same for every item
          result.hashIdCores.push(item.hashIdCore)
          return result
        },
        { ip: '', hashIdCores: [] }
      )
      console.log('flattenedSubmission')
      console.log(flattenedSubmission)

      // attempt to retrieve proofs from Core
      let getProofsFromCoreResults = []
      try {
        getProofsFromCoreResults = await cores.getProofsAsync(flattenedSubmission.ip, flattenedSubmission.hashIdCores)
      } catch (err) {
        console.error(`ERROR : getCachedCoreProofsAsync : Core ${flattenedSubmission.ip} : ${err.message}`)
      }
      console.log('getProofsFromCoreResults')
      console.log(getProofsFromCoreResults)

      // assign the returned proof values back to the `coreSubmissions` object,
      // for each item in the results, using the `submitIdForHashIdCoreLookup` object
      for (let result of getProofsFromCoreResults) {
        let submitIdForResult = submitIdForHashIdCoreLookup[result.hash_id]
        // be sure that the `submitIdForResult` is known in `coreSubmissions`
        // assuming it is, as it always should be unless error, assign the proof to that key
        if (coreSubmissions.hasOwnProperty(submitIdForResult)) {
          coreSubmissions[submitIdForResult].proof = result.proof
          // track this submitId for caching later
          newProofSubmitIds.push(submitIdForResult)
        }
      }
    }
  }
  console.log('coreSubmissions')
  console.log(coreSubmissions)

  // add anchorsComplete data to each coreSubmissions item
  for (let submitId in coreSubmissions) {
    coreSubmissions[submitId].anchorsComplete = utils.parseAnchorsComplete(coreSubmissions[submitId].proof)
  }

  // cache any new results returned from Core
  if (newProofSubmitIds.length > 0) {
    // for all new proofs received from Core, create an proofType lookup object for use in determining
    // proper cache TTL for the proof
    let proofTypeLookup = newProofSubmitIds.reduce((result, submitId) => {
      if (!_.isNil(coreSubmissions[submitId].proof)) {
        result[submitId] = coreSubmissions[submitId].anchorsComplete.includes('btc') ? 'btc' : 'cal'
      }
      return result
    }, {})

    // Store the non-null proofs from Core in the local cache for subsequent requests
    // First, create the array of objects to be written to the cache
    let uncachedCoreProofObjects = newProofSubmitIds.reduce((result, submitId) => {
      if (!_.isNil(coreSubmissions[submitId].proof)) {
        result.push({
          submitId: submitId,
          coreProof: coreSubmissions[submitId].proof,
          // `cal` cached proofs expire after 15 minutes
          // `btc` cached proofs expire after 25 hours
          expiresAt: Date.now() + (proofTypeLookup[submitId] === 'btc' ? 25 * 60 : 15) * 60 * 1000
        })
      }
      return result
    }, [])

    // Next, attempt to write proofs to cache
    try {
      for (let coreProofObject of uncachedCoreProofObjects) {
        CORE_PROOF_CACHE[coreProofObject.submitId] = {
          coreProof: coreProofObject.coreProof,
          expiresAt: coreProofObject.expiresAt
        }
      }
    } catch (error) {
      console.error(`Cache write error : saveCoreProofsToCacheAsync : ${error.message}`)
    }
  }

  // format `coreSubmissions` into the proper result object to return from this function
  let finalProofResults = Object.keys(coreSubmissions).map(submitId => {
    if (_.isNil(coreSubmissions[submitId].proof)) return { submitId: submitId, proof: null }
    // A proof exists and has been found for this submitId
    // Identify the anchors completed in this proof and append that information
    return {
      submitId: submitId,
      proof: coreSubmissions[submitId].proof,
      anchorsComplete: coreSubmissions[submitId].anchorsComplete
    }
  })

  // Finally, return the proof items array
  return finalProofResults
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
  setCores: c => {
    cores = c
  }
}
