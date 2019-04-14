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
const tknDefinition = require('../artifacts/ethcontracts/TierionNetworkToken.json')

async function getActiveUsageTokenAsync() {
  try {
    // attempt to retrieve active usage token
    let activeUsageToken = await rocksDB.getUsageTokenAsync()
    // if nothing was returned, acquire a new usage token
    if (activeUsageToken === null) {
      return await acquireNewUsageTokenAsync()
    }
    // get the decoded JWT object
    let decodedToken = jwt.decode(activeUsageToken, {
      complete: true
    })
    let expTime = decodedToken.payload.exp * 1000 // get expiration time in milliseconds
    let balance = decodedToken.payload.bal
    // if the token is currently valid, return it, otherwise attempt to refresh
    if (expTime > Date.now()) {
      return activeUsageToken
    } else {
      if (balance > 0) {
        // attempt to refresh the token
        let updatedToken = await cores.refreshUsageTokenAsync(activeUsageToken)
        if (updatedToken === null) throw new Error('No valid usage token in use : Could not refresh existing token')
        // save new usage token as active token
        await rocksDB.setUsageTokenAsync(updatedToken)
        return updatedToken
      } else {
        // this token has no further value, attempt to acquire a new one
        return await acquireNewUsageTokenAsync()
      }
    }
  } catch (error) {
    throw new Error(`Unable to get active token : ${error.message}`)
  }
}

async function acquireNewUsageTokenAsync() {
  if (!env.AUTO_ACQUIRE_ENABLED) throw new Error('No valid usage token in use : Auto acquire new token disabled')
  let newUsageToken = await fundNewCreditBalanceAsync(env.AUTO_ACQUIRE_AMOUNT)
  if (newUsageToken === null) throw new Error('No valid usage token in use : Could not acquire new token')
  // save new usage token as active token
  await rocksDB.setUsageTokenAsync(newUsageToken)
  return newUsageToken
}

async function fundNewCreditBalanceAsync(creditAmount) {
  // TODO: Update usage of $TKN and 'token' in variables and comments
  // Get the $TKN cost for desired number of credits, gas price, and nonce for given address
  let coreETHStats = await cores.getETHStatsByAddressAsync(env.NODE_ETH_ADDRESS)
  // build a transaction sending `tokenAmount` $TKN to Core
  let tokenAmount = coreETHStats.creditPrice * creditAmount
  let gasPrice = coreETHStats.gasPrice
  let nonce = coreETHStats.transactionCount
  let rawTransaction = buildRawCreditTransaction(tokenAmount, gasPrice, nonce)
  // publish this transaction to ETH network using Core, receive new token
  // Note: this is a relatively long running task, with timeout set to 60 seconds
  // Core will publish the transaction and wait for it to be confirmed.
  // Once confirmed, Core will construct and deliver a new usage token with the desired credit balance.
  let newUsageToken = await cores.purchaseCreditsAsync(rawTransaction)
  return newUsageToken
}

function buildRawCreditTransaction(tokenAmount, gasPrice, nonce) {
  const tknContractAddr = tknDefinition.networks['1'].address
  const wallet = new ethers.Wallet(env.NODE_ETH_PRIVATE_KEY)
  const contractInterface = new ethers.Interface(tknDefinition.abi)

  const burnAddress = 0x0000000000000000000000000000000000000000 // TODO: Update this

  let functionCall = contractInterface.functions.transfer(burnAddress, tokenAmount)

  var tx = {
    gasPrice: gasPrice,
    gasLimit: 60000,
    data: functionCall.data,
    to: tknContractAddr,
    nonce: nonce
  }

  var signedTransaction = wallet.sign(tx)
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
  }
}
