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
    'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUI2VENDQVpDZ0F3SUJBZ0lRUkpSZUpTcEdDSzYzY0hSSlZjZmVGREFLQmdncWhrak9QUVFEQWpBNE1SOHcKSFFZRFZRUUtFeFpzYm1RZ1lYVjBiMmRsYm1WeVlYUmxaQ0JqWlhKME1SVXdFd1lEVlFRREV3eGxZVFU0TmpBeApNamMzTURnd0hoY05NVGt3T0RJMk1qSXlPREUxV2hjTk1qQXhNREl3TWpJeU9ERTFXakE0TVI4d0hRWURWUVFLCkV4WnNibVFnWVhWMGIyZGxibVZ5WVhSbFpDQmpaWEowTVJVd0V3WURWUVFERXd4bFlUVTROakF4TWpjM01EZ3cKV1RBVEJnY3Foa2pPUFFJQkJnZ3Foa2pPUFFNQkJ3TkNBQVNBbEY5Um53NklBU3o2b1VrL2pUQmQyTUN2ZGhPNQpTczZ3KzFZRTdTU242N2kvSW0vZjA2M2xweVNON2cvdXB4RFlNN2dZNmZCMVFXalRYVmhtSVJ0aG8zd3dlakFPCkJnTlZIUThCQWY4RUJBTUNBcVF3RHdZRFZSMFRBUUgvQkFVd0F3RUIvekJYQmdOVkhSRUVVREJPZ2d4bFlUVTQKTmpBeE1qYzNNRGlDQ1d4dlkyRnNhRzl6ZElJRGJHNWtnZ1IxYm1sNGdncDFibWw0Y0dGamEyVjBod1IvQUFBQgpoeEFBQUFBQUFBQUFBQUFBQUFBQUFBQUJod1NzRWdBQ01Bb0dDQ3FHU000OUJBTUNBMGNBTUVRQ0lESnIwREJpCjh5MmVkcjZudjQ2MmtuVU1DM3VsUlhvc095ejRQdlRLRE5JRkFpQUtFQVpyTllSRC91UzRzd0ZSaldPWGE4Y0UKVFpjaDgwT3VGRURMVEdCeStnPT0KLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=', //'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUI2ekNDQVpLZ0F3SUJBZ0lSQU1LMW1OdjF0dldKU1F6ZmYwZ0owNkl3Q2dZSUtvWkl6ajBFQXdJd09ERWYKTUIwR0ExVUVDaE1XYkc1a0lHRjFkRzluWlc1bGNtRjBaV1FnWTJWeWRERVZNQk1HQTFVRUF4TU1OR1l4WVRsaApabUkzWlRNME1CNFhEVEU1TURnd056QTRORGcwTWxvWERUSXdNVEF3TVRBNE5EZzBNbG93T0RFZk1CMEdBMVVFCkNoTVdiRzVrSUdGMWRHOW5aVzVsY21GMFpXUWdZMlZ5ZERFVk1CTUdBMVVFQXhNTU5HWXhZVGxoWm1JM1pUTTAKTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFNS9JaytSVXpySTcvTklYWnNYVm14bXRnN1h3UwpocUZuM3NTQk9tcjNhRkQvT29aUGxDM05uN3o0SDl5Y1lqeWlGUmNLT0NVSjR1c1hHUW1hTEZqTjk2TjlNSHN3CkRnWURWUjBQQVFIL0JBUURBZ0trTUE4R0ExVWRFd0VCL3dRRk1BTUJBZjh3V0FZRFZSMFJCRkV3VDRJTU5HWXgKWVRsaFptSTNaVE0wZ2dsc2IyTmhiR2h2YzNTQ0JIVnVhWGlDQ25WdWFYaHdZV05yWlhTSEJIOEFBQUdIRUFBQQpBQUFBQUFBQUFBQUFBQUFBQUFHSEJNQ29RQUtIQkNKQ09Ka3dDZ1lJS29aSXpqMEVBd0lEUndBd1JBSWdDYTk5CktqMk5haU01NENZaGZKdjMxK1lxQ0tUVUpNOE5mT1AwbWR6dTFTZ0NJSHlLU3R6VDZjcFh5c2tjQ2FHTjVvUGUKQ01XK28vdzVYMnVqYzVtTUNuNXUKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=',
  macaroon:
    'AgEDbG5kAs8BAwoQE19vJMD8knJ8tkOxQqw52xIBMBoWCgdhZGRyZXNzEgRyZWFkEgV3cml0ZRoTCgRpbmZvEgRyZWFkEgV3cml0ZRoXCghpbnZvaWNlcxIEcmVhZBIFd3JpdGUaFgoHbWVzc2FnZRIEcmVhZBIFd3JpdGUaFwoIb2ZmY2hhaW4SBHJlYWQSBXdyaXRlGhYKB29uY2hhaW4SBHJlYWQSBXdyaXRlGhQKBXBlZXJzEgRyZWFkEgV3cml0ZRoSCgZzaWduZXISCGdlbmVyYXRlAAAGIIB5+ioHBNDGgtd57AWXTbwGGz0faiEbL3ybNj6296gv', // 'AgEDbG5kAs8BAwoQiSSywq0J30ZVTE5QydJl5BIBMBoSCgZTaWduZXISCGdlbmVyYXRlGhYKB2FkZHJlc3MSBHJlYWQSBXdyaXRlGhMKBGluZm8SBHJlYWQSBXdyaXRlGhcKCGludm9pY2VzEgRyZWFkEgV3cml0ZRoWCgdtZXNzYWdlEgRyZWFkEgV3cml0ZRoXCghvZmZjaGFpbhIEcmVhZBIFd3JpdGUaFgoHb25jaGFpbhIEcmVhZBIFd3JpdGUaFAoFcGVlcnMSBHJlYWQSBXdyaXRlAAAGICuuWrL8lR+ZJdA9lQtB7CVIXQ80Ie7xUGNlmjw5xFRE',
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
          pubkey: '027a7fa2f9bfed892845a6e6ee4a27e4414caa80b6fe62aadf251e85512fd5bc84',
          host: '34.67.129.220:9735'
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
