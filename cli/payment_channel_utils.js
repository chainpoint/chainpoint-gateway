const fs = require('fs')
const path = require('path')
const lnService = require('ln-service')
const lightning = require('lnrpc-node-client')
const homedir = require('os').homedir()
// const env = require('../lib/parse-env').env
// const utils = require('../lib/utils')

// const args = process.argv.slice(2)

function toBase64(file) {
  var body = fs.readFileSync(file)
  return body.toString('base64').replace(/\s/g, '')
}

lightning.setCredentials(
  '127.0.0.1:10009',
  path.resolve(homedir, '.lnd/data/chain/bitcoin/testnet/admin.macaroon'),
  path.resolve(homedir, '.lnd/tls.cert')
)

const { lnd } = lnService.authenticatedLndGrpc({
  cert: toBase64(path.resolve(homedir, '.lnd/tls.cert')),
  macaroon: path.resolve(homedir, '.lnd/data/chain/bitcoin/testnet/admin.macaroon'),
  socket: '127.0.0.1:10009' // '34.66.56.153:10009'
})

// const listChannels = opts => {
//   return new Promise((resolve, reject) => {
//     lightning.lightning().listChannels(opts, (err, res) => {
//       if (err) reject(err)
//       else resolve(res)
//     })
//   })
// }

// ;(async function main() {
//   try {
// const hotWalletPassword = process.env.HOT_WALLET_PASSWORD
// const hotWalletSeed = process.env.HOT_WALLET_SEED

//     lightning.setTls('127.0.0.1:10009', `${homedir}/.lnd/tls.cert`)
//     let unlocker = lightning.unlocker()
//     lightning.promisifyGrpc(unlocker)

//     await unlocker.initWalletAsync({
//       wallet_password: hotWalletPassword,
//       cipher_seed_mnemonic: hotWalletSeed.split(' ')
//     })
//     await utils.sleepAsync(5000)
//     await unlocker.unlockWalletAsync({ wallet_password: hotWalletPassword, recovery_window: 25000 })

//     /**
//      * 1. List All Active Payment Channels
//      */
//     if (args.includes('--addPeer')) {
//       let socket = ''
//       let pubkey = ''
//       let addPeerRes = await lnService.addPeer({ lnd, socket, public_key: pubkey })
//       console.log('====================================')
//       console.log('addPeerRes:\n', addPeerRes)
//       console.log('====================================')
//     }

//     if (args.includes('--openChannel')) {
//       let pubkey = ''
//       try {
//         let openChannelRes = await lnService.openChannel({
//           lnd,
//           partner_public_key: pubkey,
//           local_tokens: 100000
//         })

//         console.log('Opened Payment Channel -> ' + pubkey, openChannelRes)
//       } catch (error) {
//         console.warn(`Unable to open payment channel with Core: ${pubkey} : ${JSON.stringify(error)}`)
//         return Promise.reject(error)
//       }
//     }

//     if (args.includes('--listChannels')) {
//       let listChannelsRes = await lnService.getChannels({ lnd })
//       console.log('====================================')
//       console.log('Open Payment Channels:\n', listChannelsRes)
//       console.log('====================================')
//     }

//     /**
//      * 2. CLOSING A CHANNEL
//      */
//     if (args.includes('--closeChannel')) {
//       const closing = await lnService.closeChannel({
//         transaction_id: '',
//         transaction_vout: 0,
//         is_force_close: true,
//         lnd
//       })
//       console.log('====================================')
//       console.log('Closing Channel... This will take several minutes.', closing)
//       console.log('====================================')
//     }

//     // C. Get Pending Channels
//     if (args.includes('--getPendingChannels')) {
//       let getPendingChannelsRes = await lnService.getPendingChannels({ lnd })
//       console.log('====================================')
//       console.log('All Pending Channels:\n', getPendingChannelsRes)
//       console.log('====================================')
//     }

//     // B. Get Peers
//     if (args.includes('--getPeers')) {
//       let getPeersRes = await lnService.getPeers({ lnd })
//       console.log('====================================')
//       console.log('All Peer Connections:\n', getPeersRes)
//       console.log('====================================')
//     }

//     // B. Get Peers
//     if (args.includes('--getTxs')) {
//       let getTxsRes = await lnService.getChainTransactions({ lnd })
//       console.log('====================================')
//       console.log('All Txs:\n', JSON.stringify(getTxsRes))
//       console.log('====================================')
//     }

//     // getWalletInfo
//     if (args.includes('--getWalletInfo')) {
//       let getWalletInfoRes = await lnService.getWalletInfo({ lnd })
//       console.log('====================================')
//       console.log('getWalletInfo:\n', JSON.stringify(getWalletInfoRes))
//       console.log('====================================')
//     }
//   } catch (error) {
//     console.error('Error: ', error)
//     process.exit(1)
//   }

//   process.exit(0)
// })()

module.exports.getWalletInfo = async () => {
  return await lnService.getWalletInfo({ lnd })
}
