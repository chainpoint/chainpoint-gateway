const path = require('path')
const lnService = require('ln-service')
const lightning = require('lnrpc-node-client')
const homedir = require('os').homedir()

// let env = require('../../lib/parse-env').env
// let { connectAsync, getAllCoreIPs } = require('../../lib/cores')

// const hotWalletPassword = fs.readFileSync('/run/secrets/hot_wallet_pass', 'utf8')
// const hotWalletAddress = fs.readFileSync('/run/secrets/hot_wallet_addr', 'utf8')

const args = process.argv.slice(2)

// const openChannel = opts => {
//   return new Promise((resolve, reject) => {
//     lightning.lightning().openChannel(opts, (err, res) => {
//       if (err) reject(err)
//       else resolve(res)
//     })
//   })
// }
const listChannels = opts => {
  return new Promise((resolve, reject) => {
    lightning.lightning().listChannels(opts, (err, res) => {
      if (err) reject(err)
      else resolve(res)
    })
  })
}

const connectPeer = opts => {
  return new Promise((resolve, reject) => {
    lightning.lightning().connectPeer(opts, (err, res) => {
      if (err) reject(err)
      else resolve(res)
    })
  })
}

const disconnectPeer = opts => {
  return new Promise((resolve, reject) => {
    lightning.lightning().disconnectPeer(opts, (err, res) => {
      if (err) reject(err)
      else resolve(res)
    })
  })
}

lightning.setCredentials(
  '127.0.0.1:10009',
  path.resolve(homedir, '.lnd/data/chain/bitcoin/testnet/admin.macaroon'),
  path.resolve(homedir, '.lnd/tls.cert')
)

const { lnd } = lnService.authenticatedLndGrpc({
  cert:
    'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUI2ekNDQVpDZ0F3SUJBZ0lRWDk4VTB4eHh1NkpacnM3dUxCcStVakFLQmdncWhrak9QUVFEQWpBNE1SOHcKSFFZRFZRUUtFeFpzYm1RZ1lYVjBiMmRsYm1WeVlYUmxaQ0JqWlhKME1SVXdFd1lEVlFRREV3eGxaVGN5TURGawpZbVEzTkdRd0hoY05NVGt3T1RBek1qRXlPRFE0V2hjTk1qQXhNREk0TWpFeU9EUTRXakE0TVI4d0hRWURWUVFLCkV4WnNibVFnWVhWMGIyZGxibVZ5WVhSbFpDQmpaWEowTVJVd0V3WURWUVFERXd4bFpUY3lNREZrWW1RM05HUXcKV1RBVEJnY3Foa2pPUFFJQkJnZ3Foa2pPUFFNQkJ3TkNBQVRwc3VVc0p6WWJSZzZHUGRteVRTd1ZtRHg0STNPRwp0bTdjcCtLMG5VL2ZlR3FrRVA5dGo2VnJTeE96TEZtOXNMaDdSNGpYWW85NkNReHQ3b3lKR1hUa28zd3dlakFPCkJnTlZIUThCQWY4RUJBTUNBcVF3RHdZRFZSMFRBUUgvQkFVd0F3RUIvekJYQmdOVkhSRUVVREJPZ2d4bFpUY3kKTURGa1ltUTNOR1NDQ1d4dlkyRnNhRzl6ZElJRGJHNWtnZ1IxYm1sNGdncDFibWw0Y0dGamEyVjBod1IvQUFBQgpoeEFBQUFBQUFBQUFBQUFBQUFBQUFBQUJod1NzR0FBQ01Bb0dDQ3FHU000OUJBTUNBMGtBTUVZQ0lRRG45TzhlCjdOS054ZUg0N3hUVjRMT0Y4L2l0Mm55UHUrbEs3Q0FURC9abzVBSWhBTlRmQVhtdGZsOFVRZjFSbEFKc1UvdS8KeFlCbTZQb1JzYXhPMzFYRVhmS0oKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=',
  macaroon:
    'AgEDbG5kAs8BAwoQMzls1mNheD4W+uWJ27Q66hIBMBoWCgdhZGRyZXNzEgRyZWFkEgV3cml0ZRoTCgRpbmZvEgRyZWFkEgV3cml0ZRoXCghpbnZvaWNlcxIEcmVhZBIFd3JpdGUaFgoHbWVzc2FnZRIEcmVhZBIFd3JpdGUaFwoIb2ZmY2hhaW4SBHJlYWQSBXdyaXRlGhYKB29uY2hhaW4SBHJlYWQSBXdyaXRlGhQKBXBlZXJzEgRyZWFkEgV3cml0ZRoSCgZzaWduZXISCGdlbmVyYXRlAAAGIORO3mylhqXeQH+gXz/siembaqdAvYSM9RJOPWiLYTNG',
  socket: '127.0.0.1:10009' // '34.66.56.153:10009'
})

;(async function main() {
  // await connectAsync()

  // console.log('====================================')
  // console.log('getAllCoreIPs', getAllCoreIPs())
  // console.log('====================================')

  try {
    /**
     * 0. Add a Peer
     */
    if (args.includes('--addPeer')) {
      let addPeerRes = await connectPeer({
        addr: {
          pubkey: '02de99ad360224ba44687669908b784756ea7986e61acb876bbec01925c17d8995',
          host: '35.225.87.82:9735'
        }
      })

      console.log('====================================')
      console.log('addPeerRes', addPeerRes)
      console.log('====================================')
    }

    /**
     * 0. Add a Peer
     */
    if (args.includes('--disconnectPeer')) {
      let addPeerRes = await disconnectPeer({
        pub_key: '02eadbd9e7557375161df8b646776a547c5cbc2e95b3071ec81553f8ec2cea3b8c'
      })

      console.log('====================================')
      console.log('addPeerRes', addPeerRes)
      console.log('====================================')
    }

    /**
     * 1. OPENING A CHANNEL
     */
    if (args.includes('--openChannel')) {
      let openChannelRes = await lnService.openChannel({
        lnd,
        partner_public_key: '027a7fa2f9bfed892845a6e6ee4a27e4414caa80b6fe62aadf251e85512fd5bc84',
        local_tokens: 100000
      })
      console.log('====================================')
      console.log('openChannelRes', openChannelRes)
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
      console.log('closing', closing)
      console.log('====================================')
    }

    /******************************
     * MISC.
     ******************************/

    // A. List Channels
    if (args.includes('--listChannels')) {
      let listChannelsRes = await listChannels({ active_only: false, public_only: true })
      console.log('====================================')
      console.log('listChannelsRes', listChannelsRes)
      console.log('====================================')
    }

    // B. Get Peers
    if (args.includes('--getPeers')) {
      let getPeersRes = await lnService.getPeers({ lnd })
      console.log('====================================')
      console.log('getPeersRes', getPeersRes)
      console.log('====================================')
    }

    // C. Get Pending Channels
    if (args.includes('--getPendingChannels')) {
      let getPendingChannelsRes = await lnService.getPendingChannels({ lnd })
      console.log('====================================')
      console.log('getPendingChannelsRes', getPendingChannelsRes)
      console.log('====================================')
    }

    // D. Get Block
    if (args.includes('--getWalletInfo')) {
      let getWalletInfoRes = await lnService.getWalletInfo({ lnd })
      console.log('====================================')
      console.log('getWalletInfoRes', getWalletInfoRes)
      console.log('====================================')
    }
  } catch (error) {
    console.error('Error: ', error)
    process.exit(1)
  }

  // GET CLOSED CHANNELS
  // try {
  //   const breachCount = await lnService.getClosedChannels({ lnd, is_breach_close: true })
  //   console.log('====================================')
  //   console.log('Closed Channels'.breachCount)
  //   console.log('====================================')
  // } catch (error) {
  //   console.error('err closing channels', error.message)
  // }
  process.exit(0)
})()

// lightning.lightning().closedChannels({ local_force: true, remote_force: true }, (err, res) => {
//   console.log('====================================')
//   console.log('closedChannels:', res, err)
//   console.log('====================================')
// })

async function openChannelToCore(opts) {
  let openChannelRes = await lnService.openChannel({
    lnd,
    partner_public_key: opts.pubkey,
    local_tokens: opts.satoshis
  })

  console.log('Opened Payment Channel -> ' + opts.pubkey)

  return Object.assign({}, opts, openChannelRes)
}

module.exports = openChannelToCore
