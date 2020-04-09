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

const { version } = require('../../package.json')
let env = require('../parse-env.js').env

/**
 * GET /config handler
 *
 * Returns a configuration information object
 */

let lnd

async function getConfigInfoAsync(req, res, next) {
  res.contentType = 'application/json'
  let info
  try {
    info = await lnd.callMethodAsync('lightning', 'getInfoAsync', null, env.HOT_WALLET_PASS)
  } catch (error) {
    info = { error: error.message }
  }
  let balance
  try {
    balance = await lnd.callMethodAsync('lightning', 'walletBalanceAsync', null, env.HOT_WALLET_PASS)
  } catch (error) {
    balance = { error: error.message }
  }
  res.send({
    lndInfo: info,
    lightning_balance: balance,
    version: version,
    time: new Date().toISOString()
  })
  return next()
}

module.exports = {
  getConfigInfoAsync: getConfigInfoAsync,
  setLnd: lndObj => {
    lnd = lndObj
  }
}
