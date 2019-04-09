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

async function getActiveUsageTokenAsync() {
  // attempt to retrieve active usage token
  let activeUsageToken = await rocksDB.getUsageTokenAsync()
  // if nothing was returned, acquire a new usage token
  if (activeUsageToken === null) {
    return await acquireNewUsageTokenAsync()
  }
  // get the decoded JWT object
  let decodedToken = jwt.decode(activeUsageToken, { complete: true })
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
}

async function acquireNewUsageTokenAsync() {
  if (!env.AUTO_ACQUIRE_ENABLED) throw new Error('No valid usage token in use : Auto acquire new token disabled')
  let newUsageToken = await fundNewCreditBalanceAsync(env.AUTO_ACQUIRE_AMOUNT)
  if (newUsageToken === null) throw new Error('No valid usage token in use : Could not acquire new token')
  return newUsageToken
}

async function fundNewCreditBalanceAsync(amount) {
  // TODO: Implement transaction construction, publish to Core
  return amount
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
