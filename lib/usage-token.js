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

let tknDefinition = require('../artifacts/ethcontracts/TierionNetworkToken.json')

async function getActiveUsageTokenAsync() {
  try {
    // attempt to retrieve active usage token
    let activeUsageToken = await rocksDB.getUsageTokenAsync()
    // if nothing was returned, acquire a new usage token
    if (activeUsageToken === null) {
      console.log(`INFO : Usage Token : No token found in storage`)
      return await acquireNewUsageTokenAsync()
    } else {
      console.log(`INFO : Usage Token : Active token retrieved from storage`)
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
        console.log(`INFO : Usage Token : Active token has expired with balance remaining, will refresh`)
        // attempt to refresh the token
        let updatedToken = await cores.refreshUsageTokenAsync(activeUsageToken)
        if (updatedToken === null) throw new Error('No valid usage token in use : Could not refresh existing token')
        // save new usage token as active token
        await rocksDB.setUsageTokenAsync(updatedToken)
        console.log(`INFO : Usage Token : Token refreshed : Updated balance of ${balance - 1} credit(s)`)
        return updatedToken
      } else {
        console.log(`INFO : Usage Token : Active token has expired with 0 balance, will acquire new token`)
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
  console.log(`INFO : Usage Token : New token acquired with ${env.AUTO_ACQUIRE_AMOUNT} credit(s)`)
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
  let rawTransaction = await buildRawCreditTransactionAsync(tokenAmount, gasPrice, nonce)
  // publish this transaction to ETH network using Core, receive new token
  // Note: this is a relatively long running task, with timeout set to 60 seconds
  // Core will publish the transaction and wait for it to be confirmed.
  // Once confirmed, Core will construct and deliver a new usage token with the desired credit balance.
  let newUsageToken = await cores.purchaseCreditsAsync(rawTransaction)
  return newUsageToken
}

async function buildRawCreditTransactionAsync(tokenAmount, gasPrice, nonce) {
  const tknContractAddr = tknDefinition.networks['3'].address // TODO: Hardcoded ropsten, teach Node about prod and dev (homestead/ropsten)
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
