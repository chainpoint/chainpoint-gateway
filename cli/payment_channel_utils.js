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

const lnService = require('ln-service')
const lightning = require('lnrpc-node-client')
const { find } = require('lodash')
const homedir = require('os').homedir()
const utils = require('../lib/utils')
const commandLineArgs = require('command-line-args')

const args = process.argv.slice(2)

const LND_SOCKET = '127.0.0.1:10009'
const LND_CERTPATH = `${homedir}/.lnd/chainpoint-node/tls.cert`
const LND_MACAROONPATH = `${homedir}/.lnd/chainpoint-node/data/chain/bitcoin/${env.NETWORK}/admin.macaroon`

const { lnd } = lnService.authenticatedLndGrpc({
  cert: utils.toBase64(LND_CERTPATH),
  macaroon: utils.toBase64(LND_MACAROONPATH),
  socket: LND_SOCKET
})

lightning.setCredentials(LND_SOCKET, LND_MACAROONPATH, LND_CERTPATH)
;(async function main() {
  try {
    /**
     * 0. Is LND Node fully synced?
     *
     * This method dictates whether it is safe to start interacting with the LND to create channels, peer cxns, etc.
     */
    if (args.includes('--isSyncedToChain')) {
      let getWalletInfoRes = await lnService.getWalletInfo({ lnd })
      let isSynced = getWalletInfoRes.is_synced_to_chain
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

      let getPeersRes = await lnService.getPeers({ lnd })
      console.log('====================================')
      console.log(
        'All Peer Connections:\n',
        args.pubkey ? find(getPeersRes.peers, ['public_key', args.pubkey]) : getPeersRes
      )
      console.log('====================================')
    }

    if (args.includes('--addPeer')) {
      const argsDefinitions = [{ name: 'socket' }, { name: 'pubkey' }, { name: 'addPeer' }]
      const args = commandLineArgs(argsDefinitions)

      let socket = args.socket
      let pubkey = args.pubkey
      let addPeerRes = await lnService.addPeer({ lnd, socket, public_key: pubkey })
      console.log('====================================')
      console.log('addPeerRes:\n', addPeerRes)
      console.log('====================================')
    }

    if (args.includes('--openChannel')) {
      const argsDefinitions = [{ name: 'satoshis' }, { name: 'pubkey' }, { name: 'openChannel' }]
      const args = commandLineArgs(argsDefinitions)

      let pubkey = ''
      try {
        let openChannelRes = await lnService.openChannel({
          lnd,
          partner_public_key: args.pubkey,
          local_tokens: args.satoshis
        })

        console.log('Opened Payment Channel -> ' + pubkey, openChannelRes)
      } catch (error) {
        console.warn(`Unable to open payment channel with Core: ${pubkey} : ${JSON.stringify(error)}`)
        return Promise.reject(error)
      }
    }

    if (args.includes('--listChannels')) {
      let listChannelsRes = await lnService.getChannels({ lnd })
      console.log('====================================')
      console.log('Open Payment Channels:\n', listChannelsRes)
      console.log('====================================')
    }

    /**
     * 2. CLOSING A CHANNEL
     */
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

    // C. Get Pending Channels
    if (args.includes('--getPendingChannels')) {
      let getPendingChannelsRes = await lnService.getPendingChannels({ lnd })
      console.log('====================================')
      console.log('All Pending Channels:\n', getPendingChannelsRes)
      console.log('====================================')
    }

    if (args.includes('--getTxs')) {
      let getTxsRes = await lnService.getChainTransactions({ lnd })
      console.log('====================================')
      console.log('All Txs:\n', JSON.stringify(getTxsRes))
      console.log('====================================')
    }

    // getWalletInfo
    if (args.includes('--getWalletInfo')) {
      let getWalletInfoRes = await lnService.getWalletInfo({ lnd })
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
  const { lnd } = lnService.authenticatedLndGrpc({
    cert: utils.toBase64(LND_CERTPATH),
    macaroon: utils.toBase64(LND_MACAROONPATH),
    socket: LND_SOCKET
  })

  return await lnService.getWalletInfo({ lnd })
}
