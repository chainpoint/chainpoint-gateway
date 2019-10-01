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

const lnRPCNodeClient = require('lnrpc-node-client')
const retry = require('async-retry')
const homedir = require('os').homedir()

// track if unlock is in process to prevent multiple simultaneous unlock errors
let IS_UNLOCKING = false

let lnd = function(socket, network, unlockOnly = false, inHostContext = false) {
  if (!['mainnet', 'testnet'].includes(network)) throw new Error('Invalid network value')

  const LND_DIR = `${homedir}/${inHostContext ? '.chainpoint/node/' : ''}.lnd`
  const LND_SOCKET = socket
  const LND_CERTPATH = `${LND_DIR}/tls.cert`
  if (unlockOnly) {
    lnRPCNodeClient.setTls(LND_SOCKET, LND_CERTPATH)
  } else {
    const LND_MACAROONPATH = `${LND_DIR}/data/chain/bitcoin/${network}/admin.macaroon`
    lnRPCNodeClient.setCredentials(LND_SOCKET, LND_MACAROONPATH, LND_CERTPATH)
  }

  // Call the service method with the given parameter
  // If a locked wallet is detected, wallet unlock is attempted and call is retried
  this.callMethodAsync = async (service, method, params) => {
    let lndService = lnRPCNodeClient[service]()
    try {
      return await lndService[method](params)
    } catch (error) {
      if (error.code === 12) {
        // error code 12 indicates wallet may be locked
        if (!IS_UNLOCKING) {
          IS_UNLOCKING = true
          try {
            await lnRPCNodeClient.unlocker().unlockWalletAsync({ wallet_password: env.HOT_WALLET_PASS })
          } catch (error) {
            throw new Error(`Unable to unlock LND wallet : ${error.messages}`)
          } finally {
            IS_UNLOCKING = false
          }
        }
        return await retry(async () => await lndService[method](params), { retries: 30, factor: 1, minTimeout: 500 })
      }
      throw error
    }
  }

  // Call the service method with the given parameter
  // No unlocking or retrying is perfomed with this method
  this.callMethodRawAsync = async (service, method, params) => await lnRPCNodeClient[service]()[method](params)
}

module.exports = lnd
