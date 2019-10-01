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
const env = require('../lib/parse-env').env

const { find } = require('lodash')
const commandLineArgs = require('command-line-args')
const lightning = require('../lib/lightning')

const args = process.argv.slice(2)

const LND_SOCKET = '127.0.0.1:10009'

;(async function main() {
  try {
    let lnd = new lightning(LND_SOCKET, env.NETWORK, false, true)

    /**
     * 0. Is LND Node fully synced?
     *
     * This method dictates whether it is safe to start interacting with the LND to create channels, peer cxns, etc.
     */
    if (args.includes('--isSyncedToChain')) {
      let getWalletInfoRes = await lnd.callMethodAsync('lightning', 'getInfoAsync', {})
      let isSynced = getWalletInfoRes.synced_to_chain
      console.log('====================================')
      console.log('getWalletInfo -> isSynced: \n', isSynced)
      console.log('====================================')
    }

    /**
     * 1. List All Peers
     *
     * List all active peer connections. Peer connections with the Cores you wish to create a payment channel are required.
     * IMPORTANT: Assert that there is a peer cxn with the specific Chainpoint Core you wish to open a payment channel with!
     */
    if (args.includes('--getPeers')) {
      const argsDefinitions = [{ name: 'pubkey' }, { name: 'getPeers' }]
      const args = commandLineArgs(argsDefinitions)

      let getPeersRes = await lnd.callMethodAsync('lightning', 'listPeersAsync', {})
      console.log('====================================')
      console.log(
        'All Peer Connections:\n',
        args.pubkey ? find(getPeersRes.peers, ['pub_key', args.pubkey]) : getPeersRes
      )
      console.log('====================================')
    }

    if (args.includes('--addPeer')) {
      const argsDefinitions = [{ name: 'socket' }, { name: 'pubkey' }, { name: 'addPeer' }]
      const args = commandLineArgs(argsDefinitions)

      let socket = args.socket
      let pubkey = args.pubkey
      let addPeerRes = await lnd.callMethodAsync('lightning', 'connectPeerAsync', {
        addr: { pubkey: pubkey, host: socket }
      })
      console.log('====================================')
      console.log('addPeerRes:\n', addPeerRes)
      console.log('====================================')
    }

    if (args.includes('--openChannel')) {
      const argsDefinitions = [{ name: 'satoshis' }, { name: 'pubkey' }, { name: 'openChannel' }]
      const args = commandLineArgs(argsDefinitions)

      let pubkey = ''
      try {
        let openChannelRes = await lnd.callMethodAsync('lightning', 'openChannelSyncAsync', {
          node_pubkey_string: args.pubkey,
          local_funding_amount: args.satoshis
        })

        console.log('Opened Payment Channel -> ' + pubkey, openChannelRes)
      } catch (error) {
        console.warn(`Unable to open payment channel with Core: ${pubkey} : ${JSON.stringify(error)}`)
        return Promise.reject(error)
      }
    }

    if (args.includes('--listChannels')) {
      let listChannelsRes = await lnd.callMethodAsync('lightning', 'listChannelsAsync', {})
      console.log('====================================')
      console.log('Open Payment Channels:\n', listChannelsRes)
      console.log('====================================')
    }

    /**
     * 2. CLOSING A CHANNEL
     */
    /*
    if (args.includes('--closeChannel')) {
      const closing = await lnService.closeChannel({
        transaction_id: '',
        transaction_vout: 0,
        is_force_close: true,
        lnd
      })
      console.log('====================================')
      console.log('Closing Channel... This will take several minutes.', closing)
      console.log('====================================')
    }
    */

    // C. Get Pending Channels
    if (args.includes('--getPendingChannels')) {
      let getPendingChannelsRes = await lnd.callMethodAsync('lightning', 'pendingChannelsAsync', {})
      console.log('====================================')
      console.log('All Pending Channels:\n', getPendingChannelsRes)
      console.log('====================================')
    }

    if (args.includes('--getTxs')) {
      let getTxsRes = await lnd.callMethodAsync('lightning', 'getTransactions', {})
      console.log('====================================')
      console.log('All Txs:\n', JSON.stringify(getTxsRes))
      console.log('====================================')
    }

    // getWalletInfo
    if (args.includes('--getWalletInfo')) {
      let getWalletInfoRes = await lnd.callMethodAsync('lightning', 'getInfoAsync', {})
      console.log('====================================')
      console.log('getWalletInfo:\n', JSON.stringify(getWalletInfoRes))
      console.log('====================================')
    }
  } catch (error) {
    console.error('Error: ', error)
    process.exit(1)
  }

  process.exit(0)
})()

module.exports.getWalletInfo = async lndOpts => {
  console.log(lndOpts)
  let lnd = new lightning(LND_SOCKET, env.NETWORK, false, true)
  return await lnd.callMethodAsync('lightning', 'getInfoAsync', {})
}
