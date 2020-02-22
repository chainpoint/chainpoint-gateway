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
const { Lsat } = require('lsat-js')
const _ = require('lodash')
const logger = require('./logger.js')
const utils = require('./utils.js')
const chalk = require('chalk')
const lightning = require('./lightning')

const PRUNE_EXPIRED_INTERVAL_SECONDS = 10

let CONNECTED_CORE_IPS = []
let coreConnectionCount = 1

// In some cases we may want a list of all Core Nodes (whether or not the Chainpoint Node is connected to it or not)
let ALL_CORE_IPS = []

// This is the local in-memory cache of calendar transactions
// CORE_TX_CACHE is an object keyed by txId, storing the transaction object
let CORE_TX_CACHE = {}

// Initialize the Lightning grpc object
let lnd = new lightning(env.LND_SOCKET, env.NETWORK)

async function connectAsync() {
  // Retrieve the list of Core IPs we can work with
  let coreIPList = []
  if (!_.isEmpty(env.CHAINPOINT_CORE_CONNECT_IP_LIST)) {
    // Core IPs have been supplied in CHAINPOINT_CORE_CONNECT_IP_LIST, use those IPs only
    coreIPList = env.CHAINPOINT_CORE_CONNECT_IP_LIST
  }
  coreConnectionCount = coreIPList.length

  // Select and establish connection to Core(s)
  let connectedCoreIPResult = await getConnectedCoreIPsAsync(coreIPList, coreConnectionCount)
  // warn users about env mismatch
  if (connectedCoreIPResult.networkMismatch)
    logger.warn(`Unable to connect to Cores with a different network setting. This Node is set to '${env.NETWORK}'`)
  CONNECTED_CORE_IPS = connectedCoreIPResult.ips
  // ensure we have successfully communicated with `coreConnectionCount` Cores
  // if we have not, the Node cannot continue, log error and exit
  if (!connectedCoreIPResult.connected) {
    throw new Error(`Unable to connect to ${coreConnectionCount} Core(s) as required`)
  }

  let done = false
  while (!done) {
    try {
      await waitForSync()
      await createCoreLNDPeerConnectionsAsync(connectedCoreIPResult.lnUris)
      utils.sleepAsync(10000) // takes a few seconds for peers to connect
      await createCoreLNDChannelsAsync(connectedCoreIPResult.lnUris)
      done = true
      console.log('opening lightning channels to Core complete')
    } catch (error) {
      console.log(`open peer or channel failed: ${error.message}`)
      done = false
    }
  }

  logger.info(`App : Core IPs : ${CONNECTED_CORE_IPS}`)
}

async function waitForSync() {
  let isSynced = false
  while (!isSynced) {
    try {
      let info = await lnd.callMethodAsync('lightning', 'getInfoAsync', null, env.HOT_WALLET_PASS)
      if (info.synced_to_chain) {
        console.log(chalk.green('\n*****************************************'))
        console.log(chalk.green('Your lightning node is fully synced.'))
        console.log(chalk.green('*****************************************'))
        isSynced = true
      } else {
        console.log(
          chalk.magenta(
            `${new Date().toISOString()}> Syncing in progress... currently at block height ${info.block_height}`
          )
        )
      }
    } catch (error) {
      console.log(chalk.red(`An error occurred while checking lnd state : ${error.message}`))
    } finally {
      if (!isSynced) await utils.sleepAsync(5000)
    }
  }
}

async function createCoreLNDPeerConnectionsAsync(lnUris) {
  let peerPubKeys = []
  try {
    let peerList = await lnd.callMethodAsync('lightning', 'listPeersAsync', null, env.HOT_WALLET_PASS)
    for (let peer of peerList.peers) {
      peerPubKeys.push(peer.pub_key)
    }
  } catch (error) {
    throw new Error('Could not retrieve LND peer list')
  }

  for (let lndUri of lnUris) {
    let [pubkey, host] = lndUri.split('@')
    if (peerPubKeys.includes(pubkey)) continue // already peered to this node, skip
    try {
      await lnd.callMethodAsync(
        'lightning',
        'connectPeerAsync',
        { addr: { pubkey, host }, perm: true },
        env.HOT_WALLET_PASS
      )
      console.log(chalk.yellow(`Peer connection established with ${lndUri}`))
    } catch (error) {
      throw new Error(`Unable to establish a peer connection with ${lndUri} : ${error.message}`)
    }
  }
}

async function getConnectedCoreIPsAsync(coreIPList, coreConnectionCount) {
  let getStatusOptions = buildRequestOptions(null, 'GET', '/status')

  let connectedCoreIPs = []
  let lnUris = []
  let networkMismatch = false
  coreIPList = _.shuffle(coreIPList)
  for (let coreIP of coreIPList) {
    try {
      let coreResponse = await coreRequestAsync(getStatusOptions, coreIP, 0)
      let networkMatch = coreResponse.network === env.NETWORK
      let isCoreSynced = coreResponse.sync_info.catching_up === false
      if (!networkMatch) networkMismatch = true
      if (networkMatch && isCoreSynced) connectedCoreIPs.push(coreIP)
      if (coreResponse.uris.length > 0) lnUris.push(coreResponse.uris[0])
    } catch (error) {
      console.log(`unable to contact core ${coreIP}: ${error.message}`)
    }
    // if we've made enough connections, break out of loop and return IPs
    if (connectedCoreIPs.length >= coreConnectionCount) break
  }
  return {
    connected: connectedCoreIPs.length >= coreConnectionCount,
    ips: connectedCoreIPs,
    lnUris: lnUris,
    networkMismatch
  }
}

async function createCoreLNDChannelsAsync(lnUris) {
  let channelPubKeys = []
  try {
    let channelList = await lnd.callMethodAsync('lightning', 'listChannelsAsync', {}, env.HOT_WALLET_PASS)
    for (let channel of channelList.channels) {
      channelPubKeys.push(channel.remote_pubkey)
    }
  } catch (error) {
    let msg = `Could not retrieve LND channel list: ${error.message}`
    console.log(chalk.red(msg))
    throw new Error(msg)
  }
  try {
    let channelList = await lnd.callMethodAsync('lightning', 'pendingChannelsAsync', {}, env.HOT_WALLET_PASS)
    for (let pendingChannel of channelList.pending_open_channels) {
      channelPubKeys.push(pendingChannel.channel.remote_node_pub)
    }
  } catch (error) {
    let msg = `Could not retrieve pending LND channel list: ${error.message}`
    console.log(chalk.red(msg))
    throw new Error(msg)
  }
  for (let lndUri of lnUris) {
    let pubkey = lndUri.split('@')[0]
    if (channelPubKeys.includes(pubkey)) {
      let chan = channelPubKeys[pubkey]
      // close channel if all local funds are used up
      if (
        chan.hasOwnProperty('total_satoshis_sent') &&
        chan.total_satoshis_sent > 0 &&
        chan.local_balance <= env.MAX_SATOSHI_PER_HASH
      ) {
        let fee = await lnd.callMethodAsync(
          'lightning',
          'estimateFeeAsync',
          { target_confirmations: 6 },
          env.HOT_WALLET_PASS
        )
        let closeChanReq = {
          channel_point: {
            funding_txid_bytes: Buffer.from(chan.transaction_id, 'hex').reverse(),
            output_index: chan.transaction_vout
          },
          delivery_address: env.HOT_WALLET_ADDRESS,
          force: false,
          sat_per_byte: fee.tokens_per_vbyte,
          target_conf: 6
        }
        let close = await lnd.callMethodAsync('lightning', 'closeChannelAsync', closeChanReq, env.HOT_WALLET_PASS)
        console.log(`channel close txid: ${close.close_pending.txid.reverse().toString('hex')}`)
      } else {
        continue
      }
    }
    try {
      let channelTxInfo = await lnd.callMethodAsync(
        'lightning',
        'openChannelSyncAsync',
        {
          node_pubkey_string: pubkey,
          local_funding_amount: env.CHANNEL_AMOUNT,
          push_sat: 0
        },
        env.HOT_WALLET_PASS
      )
      console.log(
        `Channel created with ${lndUri} with the following transaction Id: ${Buffer.from(
          channelTxInfo.funding_txid_bytes.data
        ).toString('hex')}`
      )
    } catch (error) {
      let msg = `Unable to create a channel with ${lndUri} : ${error.message}`
      console.log(chalk.red(msg))
      throw new Error(msg)
    }
  }
}

async function coreRequestAsync(options, coreIP, retryCount = 3, timeout = 500) {
  options.headers['X-Node-Version'] = version
  options.uri = `http://${coreIP}${options.uriPath}`

  let response
  if (retryCount <= 0) {
    try {
      response = await rp(options)
    } catch (error) {
      if (error.statusCode === 402 || error.status === 402) return error.response
      throw error
    }
  } else {
    await retry(
      async bail => {
        try {
          response = await rp(options)
        } catch (error) {
          // If no response was received or there is a status code >= 500 or payment is still pending/held,
          // then we should retry the call, throw an error
          if (!error.statusCode || error.statusCode >= 500 || error.statusCode === 402) throw error
          // errors like 409 Conflict or 400 Bad Request are not retried because the request is bad and will never succeed
          bail(error)
        }
      },
      {
        retries: retryCount, // The maximum amount of times to retry the operation. Default is 3
        factor: 1, // The exponential factor to use. Default is 2
        minTimeout: timeout, // The number of milliseconds before starting the first retry. Default is 200
        randomize: true,
        onRetry: error => {
          if (error.statusCode === 402)
            logger.warn(`Core request : 402: Payment Required. Core ${coreIP} : Request ${options.uri}. Retrying`)
          else
            logger.warn(
              `Core request : ${error.statusCode || 'no response'} : Core ${coreIP} : Request ${
                options.uri
              } - ${JSON.stringify(options, null, 2)} : ${error.message} : retrying`
            )
        }
      }
    )
  }

  return response.body
}

async function submitHashAsync(hash) {
  let responses = []
  for (let coreIP of env.CHAINPOINT_CORE_CONNECT_IP_LIST) {
    try {
      // send initial request without LSAT. Expecting an LSAT w/ invoice in response
      let postHashOptions = buildRequestOptions(null, 'POST', '/hash', { hash })
      let submitResponse = await coreRequestAsync(postHashOptions, coreIP, 0)

      // get invoice for hash submission from LSAT challenge
      let lsat = parse402Response(submitResponse)
      let submitHashInvoiceId = lsat.paymentHash
      let invoiceAmount = lsat.invoiceAmount
      let decodedPaymentRequest = lsat.invoice

      logger.info(
        `Aggregator : Invoice received from Core ${coreIP} : invoiceId : ${submitHashInvoiceId} : ${invoiceAmount}`
      )

      // ensure that the invoice amount does not exceed max payment amount
      if (invoiceAmount > env.MAX_SATOSHI_PER_HASH)
        throw new Error(
          `Aggregator : Invoice amount exceeds max setting of ${
            env.MAX_SATOSHI_PER_HASH
          } : invoiceId : ${submitHashInvoiceId} : ${invoiceAmount}`
        )

      // pay the invoice
      // since this is a hodl invoice, the request will stall until it is settled
      // so we don't want to await the response but rather continue trying submission until complete
      payInvoiceAsync(decodedPaymentRequest, submitHashInvoiceId)
        .then(() => {
          logger.info(
            `Aggregator : Invoice paid to Core ${coreIP} : invoiceId : ${submitHashInvoiceId} : ${invoiceAmount}`
          )
        })
        .catch(e => {
          logger.error(e.message)
        })
      // submit hash with paid invoice id
      let headers = { Authorization: lsat.toToken() }
      postHashOptions = buildRequestOptions(headers, 'POST', '/hash', { hash })
      // setting retries to 5 since we can't await invoice payment
      // and don't know exactly when the invoice is paid and held which is when the hash can be submitted
      submitResponse = await coreRequestAsync(postHashOptions, coreIP, 5, 1000)

      logger.info(
        `Aggregator : Hash submitted to Core ${coreIP} : invoiceId : ${submitHashInvoiceId} : ${invoiceAmount}`
      )

      responses.push({ ip: coreIP, response: submitResponse })
    } catch (error) {
      // Ignore and try next coreIP
      logger.warn(`submitHashAsync : Unable to submit to Core ${coreIP} : Hash = ${hash} : ${error.message}`)
    }
  }

  return responses
}

async function payInvoiceAsync(invoice, submitHashInvoiceId) {
  return new Promise(async (resolve, reject) => {
    var call = await lnd.callMethodAsync('lightning', 'sendPayment', {})
    call.on('data', function(response) {
      // A response was received from the server.
      call.end()
      if (response.payment_error)
        return reject(
          new Error(`Error paying invoice : SubmitHashInvoiceId = ${submitHashInvoiceId} : ${response.payment_error}`)
        )
      return resolve(response)
    })

    call.on('error', err => {
      ;(async () => await lnd.handleUnlock(err))()
      return reject(new Error(`Error paying invoice : SubmitHashInvoiceId = ${submitHashInvoiceId} : ${err.message}`))
    })

    call.write({ payment_request: invoice })
  })
}

async function getProofsAsync(coreIP, proofIds) {
  let getProofsOptions = buildRequestOptions(
    {
      proofids: proofIds.join(',')
    },
    'GET',
    '/proofs',
    null,
    20000
  )

  try {
    let coreResponse = await coreRequestAsync(getProofsOptions, coreIP, 0)
    return coreResponse
  } catch (error) {
    if (error.statusCode) throw new Error(`Invalid response on GET proof : ${error.statusCode} : ${error.message}`)
    throw new Error(`Invalid response received on GET proof : ${error.message || error}`)
  }
}

async function getLatestCalBlockInfoAsync() {
  let getStatusOptions = buildRequestOptions(null, 'GET', '/status')

  let lastError = null
  for (let coreIP of env.CHAINPOINT_CORE_CONNECT_IP_LIST) {
    try {
      let coreResponse = await coreRequestAsync(getStatusOptions, coreIP, 0)
      // if the Core is catching up, we cannot use its status to retrieve the latest cal block hash
      if (coreResponse.sync_info.catching_up) throw 'Core not fully synced'
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

  for (let coreIP of env.CHAINPOINT_CORE_CONNECT_IP_LIST) {
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

function buildRequestOptions(headerValues, method, uriPath, body, timeout = 3000) {
  return {
    headers: headerValues || {},
    method: method,
    uriPath: uriPath,
    body: body || undefined,
    json: true,
    gzip: true,
    timeout: timeout,
    resolveWithFullResponse: true,
    agent: false,
    forever: true
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

function parse402Response(response) {
  if (response.statusCode !== 402) throw new Error('Expected a 402 response')
  if (!response.headers['www-authenticate'])
    throw new Error('Missing www-authenticate header. Cannot parse LSAT challenge')

  try {
    const lsat = Lsat.fromChallenge(response.headers['www-authenticate'])
    return lsat
  } catch (e) {
    logger.error(`Could not generate LSAT from challenge: ${e.message}`)
    throw new Error('Problem processing www-authenticate header challenge for LSAT')
  }
}

module.exports = {
  connectAsync: connectAsync,
  coreRequestAsync: coreRequestAsync,
  submitHashAsync: submitHashAsync,
  getProofsAsync: getProofsAsync,
  getLatestCalBlockInfoAsync: getLatestCalBlockInfoAsync,
  getCachedTransactionAsync: getCachedTransactionAsync,
  startPruneExpiredItemsInterval: startPruneExpiredItemsInterval,
  parse402Response: parse402Response,
  getAllCoreIPs: () => ALL_CORE_IPS,
  // additional functions for testing purposes
  setCoreConnectionCount: c => (coreConnectionCount = c),
  getCoreConnectedIPs: () => CONNECTED_CORE_IPS,
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
  setLN: LN => {
    lnd = LN
  }
}
