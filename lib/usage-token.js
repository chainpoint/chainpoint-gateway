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

let cores = require('./cores.js')
let rocksDB = require('./models/RocksDB.js')
const jwt = require('jsonwebtoken')
const ethers = require('ethers')
const logger = require('./logger.js')

let tknDefinition = require('../artifacts/ethcontracts/TierionNetworkToken.json')

async function getActiveUsageTokenAsync() {
  // If this is in Private Network Mode, skip Active Token retrieval and return null
  if (env.PRIVATE_NETWORK) return null
  try {
    // attempt to retrieve active usage token
    let activeUsageToken = await rocksDB.getUsageTokenAsync()
    // if nothing was returned, acquire a new usage token
    if (activeUsageToken === null) {
      logger.info(`Usage Token : No token found in storage`)
      return await acquireNewUsageTokenAsync()
    }
    // get the decoded JWT object
    let decodedToken = jwt.decode(activeUsageToken, { complete: true })
    let expTime = decodedToken.payload.exp * 1000 // get expiration time in milliseconds
    let balance = decodedToken.payload.bal
    let aud = decodedToken.payload.aud
    let aulr = decodedToken.payload.aulr
    let isExpired = expTime <= Date.now()
    logger.info(`Usage Token : Active token retrieved from storage with balance of ${balance} credit(s)`)
    // if the token is expired and has a zero balance, acquire a new usage token
    if (isExpired && balance < 1) {
      logger.info(`Usage Token : Active token has expired with 0 balance, will acquire new token`)
      return await acquireNewUsageTokenAsync()
    }
    // if the token is expired and has a positive balance, refresh the token
    if (isExpired && balance >= 1) {
      logger.info(`Usage Token : Active token has expired with balance remaining, will refresh`)
      activeUsageToken = await cores.refreshUsageTokenAsync(activeUsageToken)
      if (activeUsageToken === null) throw new Error('No valid usage token in use : Could not refresh existing token')
      logger.info(`Usage Token : Token refreshed : Updated balance of ${balance - 1} credit(s)`)
      // save the updated usage token as new active token
      await rocksDB.setUsageTokenAsync(activeUsageToken)
    }
    // if the token audience does not match this Nodes current Core IP list, update the token audience
    let coreIPList = cores.getCoreConnectedIPs().join(',')
    if (aud !== coreIPList) {
      // if the audience update rate limit has been reached, we cannot proceed, throw error
      if (aulr < 1) throw new Error('No valid usage token in use : Could not update token audience : limit exceeded')
      // update the audience value to the current coreIPList
      logger.info(`Usage Token : Active token audience does not match currently connected Cores, will update audience`)
      activeUsageToken = await cores.updateUsageTokenAudienceAsync(activeUsageToken)
      if (activeUsageToken === null) throw new Error('No valid usage token in use : Could not update token audience')
      logger.info(`Usage Token : Token audience updated : Limit of ${aulr - 1} updates remaining for this token`)
      // save the updated usage token as new active token
      await rocksDB.setUsageTokenAsync(activeUsageToken)
    }
    return activeUsageToken
  } catch (error) {
    throw new Error(`Unable to get active token : ${error.message}`)
  }
}

async function acquireNewUsageTokenAsync() {
  if (!env.AUTO_REFILL_ENABLED) throw new Error('No valid usage token in use : Auto acquire new token disabled')
  logger.info(`Usage Token : Acquiring new token with ${env.AUTO_REFILL_AMOUNT} credit(s)`)
  let newUsageToken = await fundNewCreditBalanceAsync(env.AUTO_REFILL_AMOUNT)
  if (newUsageToken === null) throw new Error('No valid usage token in use : Could not acquire new token')
  // save new usage token as active token
  await rocksDB.setUsageTokenAsync(newUsageToken)
  logger.info(`Usage Token : New token acquired with ${env.AUTO_REFILL_AMOUNT} credit(s)`)
  return newUsageToken
}

async function fundNewCreditBalanceAsync(creditAmount) {
  // TODO: Update usage of $TKN and 'token' in variables and comments
  // Get the $TKN cost for desired number of credits, gas price, and nonce for given address
  let coreETHStats = await cores.getETHStatsByAddressAsync(false, env.NODE_ETH_ADDRESS)
  // build a transaction sending `tokenAmount` $TKN to Core
  let tokenAmount = coreETHStats.creditPrice * creditAmount
  let gasPrice = coreETHStats.gasPrice
  let nonce = coreETHStats.transactionCount
  let rawTransaction = await buildRawCreditTransactionAsync(tokenAmount, gasPrice, nonce)
  // publish this transaction to ETH network using Core, receive new token
  // Note: this is a relatively long running task, with timeout set to 60 seconds
  // Core will publish the transaction and wait for it to be confirmed.
  // Once confirmed, Core will construct and deliver a new usage token with the desired credit balance.
  let newUsageToken = await cores.purchaseCreditsAsync(rawTransaction)
  return newUsageToken
}

async function buildRawCreditTransactionAsync(tokenAmount, gasPrice, nonce) {
  const network = env.NODE_ENV === 'production' ? 'homestead' : 'ropsten'
  const tknContractAddr = tknDefinition.networks[network === 'homestead' ? '1' : '3'].address
  const wallet = new ethers.Wallet(env.NODE_ETH_PRIVATE_KEY)
  const contractInterface = new ethers.utils.Interface(tknDefinition.abi)

  let functionInfo = contractInterface.functions.purchaseUsage
  let functionData = functionInfo.encode([tokenAmount * 10 ** 8]) // convert $TKN to smallest units

  var tx = {
    gasPrice: gasPrice,
    gasLimit: 60000,
    data: functionData,
    to: tknContractAddr,
    nonce: nonce
  }

  var signedTransaction = await wallet.sign(tx)
  return signedTransaction
}

module.exports = {
  getActiveUsageTokenAsync: getActiveUsageTokenAsync,
  // additional functions for testing purposes
  setRocksDB: db => {
    rocksDB = db
  },
  setCores: c => {
    cores = c
  },
  setENV: obj => {
    env = obj
  },
  tknDefinition: tknDefinition,
  setTknDefinition: def => {
    tknDefinition = def
  }
}
