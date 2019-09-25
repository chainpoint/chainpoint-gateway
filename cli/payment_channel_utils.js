const fs = require('fs')
const path = require('path')
const lnService = require('ln-service')
const lightning = require('lnrpc-node-client')
const { find } = require('lodash')
const homedir = require('os').homedir()
// const utils = require('../lib/utils')
const commandLineArgs = require('command-line-args')

const args = process.argv.slice(2)

function toBase64(file) {
  var body = fs.readFileSync(file)
  return body.toString('base64').replace(/\s/g, '')
}

const { lnd } = lnService.authenticatedLndGrpc({
  cert: toBase64(path.resolve(homedir, '.lnd/chainpoint-node/tls.cert')),
  macaroon: toBase64(path.resolve(homedir, '.lnd/chainpoint-node/data/chain/bitcoin/testnet/admin.macaroon')),
  socket: '127.0.0.1:10009'
})

lightning.setCredentials(
  '127.0.0.1:10009',
  path.resolve(homedir, '.lnd/chainpoint-node/data/chain/bitcoin/testnet/admin.macaroon'),
  path.resolve(homedir, '.lnd/chainpoint-node/tls.cert')
)
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
    cert: toBase64(path.resolve(homedir, '.lnd/chainpoint-node/tls.cert')),
    macaroon: toBase64(path.resolve(homedir, '.lnd/chainpoint-node/data/chain/bitcoin/testnet/admin.macaroon')),
    socket: '127.0.0.1:10009' // '34.66.56.153:10009'
  })

  return await lnService.getWalletInfo({ lnd })
}
