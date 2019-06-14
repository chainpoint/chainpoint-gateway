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

// load environment variables
let env = require('./parse-env.js').env

let rp = require('request-promise-native')
const { version } = require('../package.json')
const retry = require('async-retry')
const _ = require('lodash')
const logger = require('./logger.js')

const PRUNE_EXPIRED_INTERVAL_SECONDS = 10

// The number of Cores to maintain healthy connection to
// For normal public network operation, this value must be 3
let coreConnectionCount = 3

// This is the set of seed IPs for known, long lived Core instances
const CORE_SEED_IPS = ['35.188.238.186', '35.245.53.181', '35.245.9.90']
// This set contains all the Core IPs that were found during Core discovery
// (or through env configuration) which were determined to be in a good state
// and will be used for all requests to Core from this Node
let CONNECTED_CORE_IPS = []
let CORE_LAST_SUBMITTED_TO

function getRandomCoreIp() {
  if (CONNECTED_CORE_IPS.length === 0) throw new Error('CONNECTED_CORE_IPS list is empty')
  else if (CONNECTED_CORE_IPS.length === 1) return _.head(CONNECTED_CORE_IPS)

  let ip = _(CONNECTED_CORE_IPS)
    .shuffle()
    .head()

  if (ip !== CORE_LAST_SUBMITTED_TO) {
    CORE_LAST_SUBMITTED_TO = ip
    return ip
  } else {
    return getRandomCoreIp()
  }
}
// This is the local in-memory cache of calendar transactions
// CORE_TX_CACHE is an object keyed by txId, storing the transaction object
let CORE_TX_CACHE = {}

async function connectAsync() {
  // Retrieve the list of Core IPs we can work with
  let coreIPList = []
  if (!_.isEmpty(env.CHAINPOINT_CORE_CONNECT_IP_LIST)) {
    // Core IPs have been supplied in CHAINPOINT_CORE_CONNECT_IP_LIST, use those IPs only
    coreIPList = env.CHAINPOINT_CORE_CONNECT_IP_LIST
  } else {
    // CHAINPOINT_CORE_CONNECT_IP_LIST is empty, so use Core discovery
    // If this is in Private Network Mode, skip Core discovery, as it does not apply
    if (env.PRIVATE_NETWORK === false) coreIPList = await getCoreIPListFromSeedIPsAsync()
  }

  // Select and establish connection to Core(s)
  let connectedCoreIPResult = await getConnectedCoreIPsAsync(coreIPList, coreConnectionCount)
  // warn users about env/mode mismatches
  if (connectedCoreIPResult.networkMismatch)
    logger.warn(`Unable to connect to Cores with a different network setting. This Node is set to '${env.NETWORK}'`)
  if (connectedCoreIPResult.modeMismatch)
    logger.warn(
      `Unable to connect to Cores with a different network mode. This Node is set to '${
        env.PRIVATE_NETWORK ? 'private' : 'public'
      }'`
    )
  CONNECTED_CORE_IPS = connectedCoreIPResult.ips
  // ensure we have successfully communicated with `coreConnectionCount` Cores
  // if we have not, the Node cannot continue, log error and exit
  if (!connectedCoreIPResult.connected) {
    throw new Error(`Unable to connect to ${coreConnectionCount} Core(s) as required`)
  }
  logger.info(`App : Core IPs : ${CONNECTED_CORE_IPS}`)
}

async function getCoreIPListFromSeedIPsAsync() {
  let getPeersOptions = buildRequestOptions(null, 'GET', '/peers')

  let coreSeedIPs = _.shuffle(CORE_SEED_IPS)
  for (let seedIP of coreSeedIPs) {
    try {
      let coreResponse = await coreRequestAsync(getPeersOptions, seedIP, 0)

      return coreResponse
    } catch (error) {
      // ignore, try next seedIP
    }
  }

  // no seedIP returned a valid result, return empty array
  return []
}

async function getConnectedCoreIPsAsync(coreIPList, coreConnectionCount) {
  let getStatusOptions = buildRequestOptions(null, 'GET', '/status')

  let connectedCoreIPs = []
  let networkMismatch = false
  let modeMismatch = false
  coreIPList = _.shuffle(coreIPList)
  for (let coreIP of coreIPList) {
    try {
      let coreResponse = await coreRequestAsync(getStatusOptions, coreIP, 0)
      let networkMatch = coreResponse.network === env.NETWORK
      let modeMatch = coreResponse.mode === (env.PRIVATE_NETWORK ? 'private' : 'public')
      let isCoreSynched = coreResponse.sync_info.catching_up === false
      if (!networkMatch) networkMismatch = true
      if (!modeMatch) modeMismatch = true
      if (networkMatch && modeMatch && isCoreSynched) connectedCoreIPs.push(coreIP)
    } catch (error) {
      // ignore, try next coreIP
    }
    // if we've made enough connections, break out of loop and return IPs
    if (connectedCoreIPs.length >= coreConnectionCount) break
  }
  return {
    connected: connectedCoreIPs.length >= coreConnectionCount,
    ips: connectedCoreIPs,
    networkMismatch,
    modeMismatch
  }
}

async function coreRequestAsync(options, coreIP, retryCount = 3) {
  options.headers['X-Node-Version'] = version
  options.headers['X-Node-Address'] = env.NODE_ETH_ADDRESS
  options.uri = `http://${coreIP}${options.uriPath}`

  let response
  await retry(
    async bail => {
      try {
        response = await rp(options)
      } catch (error) {
        // If no response was received or there is a status code >= 500, then we should retry the call, throw an error
        if (!error.statusCode || error.statusCode >= 500) throw error
        // errors like 409 Conflict or 400 Bad Request are not retried because the request is bad and will never succeed
        bail(error)
      }
    },
    {
      retries: retryCount, // The maximum amount of times to retry the operation. Default is 3
      factor: 1, // The exponential factor to use. Default is 2
      minTimeout: 200, // The number of milliseconds before starting the first retry. Default is 200
      maxTimeout: 400,
      randomize: true,
      onRetry: error => {
        logger.warn(
          `Core request : ${error.statusCode || 'no response'} : Core ${coreIP} : Request ${options.uri} : ${
            error.message
          } : retrying`
        )
      }
    }
  )

  return response.body
}

async function submitHashAsync(hash, token) {
  let postData = { hash }
  // If this is in Private Network Mode, skip adding the token to the submit request
  if (env.PRIVATE_NETWORK === false) postData.token = token
  let postHashoptions = buildRequestOptions(null, 'POST', '/hashes', postData)

  let responses = []
  for (let coreIP of CONNECTED_CORE_IPS) {
    try {
      let response = await coreRequestAsync(postHashoptions, coreIP, 0)
      responses.push({
        ip: coreIP,
        response: response
      })
    } catch (error) {
      // Ignore and try next coreIP
    }
  }

  return responses
}

async function getProofsAsync(coreIP, hashIdCores) {
  let getProofsOptions = buildRequestOptions(
    {
      hashids: hashIdCores.join(',')
    },
    'GET',
    '/proofs',
    null,
    5000
  )

  try {
    let coreResponse = await coreRequestAsync(getProofsOptions, coreIP)
    return coreResponse
  } catch (error) {
    if (error.statusCode) throw new Error(`Invalid response on GET proof : ${error.statusCode}`)
    throw new Error('Invalid response received on GET proof')
  }
}

async function getLatestCalBlockInfoAsync() {
  let getStatusOptions = buildRequestOptions(null, 'GET', '/status')

  let lastError = null
  for (let coreIP of CONNECTED_CORE_IPS) {
    try {
      let coreResponse = await coreRequestAsync(getStatusOptions, coreIP, 0)
      // if the Core is catching up, we cannot use its status to retrieve the latest cal block hash
      if (coreResponse.sync_info.catching_up) throw 'Core not fully synched'
      return coreResponse.sync_info
    } catch (error) {
      // Record most recent error, ignore, and try next coreIP
      lastError = error
    }
  }
  if (lastError.statusCode) throw new Error(`Invalid response on GET status : ${lastError.statusCode}`)
  throw new Error('Invalid response received on GET status')
}

async function getCachedTransactionAsync(txID) {
  // if the transaction already exists in the cache, return it
  if (CORE_TX_CACHE[txID]) return CORE_TX_CACHE[txID].transaction

  // otherwise, get the tranasction from Core
  let getTxOptions = buildRequestOptions(null, 'GET', `/calendar/${txID}`)

  for (let coreIP of CONNECTED_CORE_IPS) {
    try {
      let transaction = await coreRequestAsync(getTxOptions, coreIP)
      if (transaction) {
        // cache the result and return the transaction
        CORE_TX_CACHE[txID] = {
          transaction: transaction,
          expiresAt: Date.now() + 120 * 60 * 1000 // in 2 hours
        }
        return transaction
      }
    } catch (error) {
      // Ignore and try next coreIP
    }
  }

  return null
}

async function refreshUsageTokenAsync(activeToken) {
  // build the request to Core
  let refreshTokenOptions = buildRequestOptions(null, 'POST', `/usagetoken/refresh`, {
    token: activeToken,
    aud: CONNECTED_CORE_IPS.join(',')
  })

  let lastError = null
  for (let coreIP of CONNECTED_CORE_IPS) {
    try {
      let refreshResult = await coreRequestAsync(refreshTokenOptions, coreIP)
      if (refreshResult.token) return refreshResult.token
    } catch (error) {
      // Record most recent error, ignore, and try next coreIP
      lastError = error
    }
  }
  if (lastError.statusCode)
    throw new Error(
      `Invalid response on POST /usagetoken/refresh : ${lastError.statusCode} : ${lastError.error.message}`
    )
  throw new Error('Invalid response on POST /usagetoken/refresh')
}

async function getETHStatsByAddressAsync(verbose = false, nodeETHAddress) {
  // build the request to Core
  let ethStatsOptions = buildRequestOptions(
    null,
    'GET',
    `/eth/${nodeETHAddress}/stats${verbose ? '?verbose=true' : ''}`
  )

  let lastError = null
  for (let coreIP of CONNECTED_CORE_IPS) {
    try {
      let ethStatsResult = await coreRequestAsync(ethStatsOptions, coreIP)

      if (ethStatsResult && ethStatsResult[nodeETHAddress]) return ethStatsResult[nodeETHAddress]
    } catch (error) {
      // Record most recent error, ignore, and try next coreIP
      lastError = error
    }
  }
  if (lastError.statusCode) throw new Error(`Invalid response on GET /eth/{address}/stats : ${lastError.statusCode}`)
  throw new Error('Invalid response on GET /eth/{address}/stats')
}

async function broadcastEthTxAsync(rawTransaction) {
  // build Eth Tx broadcast request to Core
  let ethBroadcastOptions = buildRequestOptions(null, 'POST', `/eth/broadcast`, { tx: rawTransaction }, 180000)

  let coreIP = getRandomCoreIp()

  try {
    let ethTxResult = await coreRequestAsync(ethBroadcastOptions, coreIP, 0)

    return ethTxResult
  } catch (error) {
    if (error.statusCode)
      throw new Error(`Invalid response on POST /eth/broadcast : ${error.statusCode} : ${error.error.message}`)
    throw new Error('Invalid response on POST /eth/broadcast')
  }
}

async function purchaseCreditsAsync(rawTransaction) {
  // build the request to Core
  let purchaseCreditsOptions = buildRequestOptions(
    null,
    'POST',
    `/usagetoken/credit`,
    { aud: CONNECTED_CORE_IPS.join(','), tx: rawTransaction },
    90000
  )

  let lastError = null
  for (let coreIP of CONNECTED_CORE_IPS) {
    try {
      let purchaseCreditsResult = await coreRequestAsync(purchaseCreditsOptions, coreIP)
      if (purchaseCreditsResult.token) return purchaseCreditsResult.token
      throw new Error('No token returned')
    } catch (error) {
      // Record most recent error, ignore, and try next coreIP
      lastError = error
    }
  }
  if (lastError.statusCode)
    throw new Error(
      `Invalid response on POST /usagetoken/credit : ${lastError.statusCode} : ${lastError.error.message}`
    )
  throw new Error('Invalid response on POST /usagetoken/credit')
}

async function updateUsageTokenAudienceAsync(activeToken) {
  // build the request to Core
  let updateTokenAudienceOptions = buildRequestOptions(null, 'POST', `/usagetoken/audience`, {
    aud: CONNECTED_CORE_IPS.join(','),
    token: activeToken
  })

  let lastError = null
  for (let coreIP of CONNECTED_CORE_IPS) {
    try {
      let updateResult = await coreRequestAsync(updateTokenAudienceOptions, coreIP)
      if (updateResult.token) return updateResult.token
    } catch (error) {
      // Record most recent error, ignore, and try next coreIP
      lastError = error
    }
  }
  if (lastError.statusCode)
    throw new Error(
      `Invalid response on POST /usagetoken/audience : ${lastError.statusCode} : ${lastError.error.message}`
    )
  throw new Error('Invalid response on POST /usagetoken/audience')
}

function buildRequestOptions(headerValues, method, uriPath, body, timeout = 3000) {
  return {
    headers: headerValues || {},
    method: method,
    uriPath: uriPath,
    body: body || undefined,
    json: true,
    gzip: true,
    timeout: timeout,
    resolveWithFullResponse: true
  }
}

function pruneExpiredItems() {
  let now = Date.now()
  for (let key in CORE_TX_CACHE) {
    if (CORE_TX_CACHE[key].expiresAt <= now) {
      delete CORE_TX_CACHE[key]
    }
  }
}

function startPruneExpiredItemsInterval() {
  return setInterval(pruneExpiredItems, PRUNE_EXPIRED_INTERVAL_SECONDS * 1000)
}

module.exports = {
  connectAsync: connectAsync,
  coreRequestAsync: coreRequestAsync,
  submitHashAsync: submitHashAsync,
  getProofsAsync: getProofsAsync,
  getLatestCalBlockInfoAsync: getLatestCalBlockInfoAsync,
  getCachedTransactionAsync: getCachedTransactionAsync,
  startPruneExpiredItemsInterval: startPruneExpiredItemsInterval,
  refreshUsageTokenAsync: refreshUsageTokenAsync,
  getETHStatsByAddressAsync: getETHStatsByAddressAsync,
  broadcastEthTxAsync: broadcastEthTxAsync,
  purchaseCreditsAsync: purchaseCreditsAsync,
  updateUsageTokenAudienceAsync: updateUsageTokenAudienceAsync,
  getCoreConnectedIPs: () => CONNECTED_CORE_IPS,
  // additional functions for testing purposes
  pruneExpiredItems: pruneExpiredItems,
  getPruneExpiredIntervalSeconds: () => PRUNE_EXPIRED_INTERVAL_SECONDS,
  getCoreTxCache: () => CORE_TX_CACHE,
  setCoreTxCache: obj => {
    CORE_TX_CACHE = obj
  },
  setENV: obj => {
    env = obj
  },
  setRP: RP => {
    rp = RP
  },
  setCoreConnectedIPs: ips => {
    CONNECTED_CORE_IPS = ips
  },
  setCoreConnectionCount: num => {
    coreConnectionCount = num
  }
}
