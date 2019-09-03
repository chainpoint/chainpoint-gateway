const path = require('path')
const lnService = require('ln-service')
const lightning = require('lnrpc-node-client')
const homedir = require('os').homedir()

// let env = require('../../lib/parse-env').env

const args = process.argv.slice(2)

const listChannels = opts => {
  return new Promise((resolve, reject) => {
    lightning.lightning().listChannels(opts, (err, res) => {
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
    'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUI2ekNDQVpDZ0F3SUJBZ0lRRTloRmtnRGZzL3RsYjZsSDFFM2VYekFLQmdncWhrak9QUVFEQWpBNE1SOHcKSFFZRFZRUUtFeFpzYm1RZ1lYVjBiMmRsYm1WeVlYUmxaQ0JqWlhKME1SVXdFd1lEVlFRREV3dzBObVUzWVRFegpOREU0TXpRd0hoY05NVGt3T1RBeU1UY3lOekV5V2hjTk1qQXhNREkzTVRjeU56RXlXakE0TVI4d0hRWURWUVFLCkV4WnNibVFnWVhWMGIyZGxibVZ5WVhSbFpDQmpaWEowTVJVd0V3WURWUVFERXd3ME5tVTNZVEV6TkRFNE16UXcKV1RBVEJnY3Foa2pPUFFJQkJnZ3Foa2pPUFFNQkJ3TkNBQVFaTGFJTjRCcXAyRjJLL2R2bUMrRTNhVnp2aHFBRApvK0phUGpNVEdRMmx2dkxKODlGNGo0WWt4MWJQeDQzb0hLYkdIR2xQSUJKZVRHaWFTeWVtSER0UW8zd3dlakFPCkJnTlZIUThCQWY4RUJBTUNBcVF3RHdZRFZSMFRBUUgvQkFVd0F3RUIvekJYQmdOVkhSRUVVREJPZ2d3ME5tVTMKWVRFek5ERTRNelNDQ1d4dlkyRnNhRzl6ZElJRGJHNWtnZ1IxYm1sNGdncDFibWw0Y0dGamEyVjBod1IvQUFBQgpoeEFBQUFBQUFBQUFBQUFBQUFBQUFBQUJod1NzRXdBQ01Bb0dDQ3FHU000OUJBTUNBMGtBTUVZQ0lRRFNieGlRCnN4OTlMMmFmR2xUQ0NaM2NUZHcxdnc4dmVhV3pnd3VTeVV0VFFBSWhBTkd2UlBqdWRZTE9lc1dXSE9wOTVqMEwKb3ZqQStZRnIrS2ttNGdYT014RkwKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=',
  macaroon:
    'AgEDbG5kAs8BAwoQKi8EbDEr+ntkjSUYeqXC1BIBMBoWCgdhZGRyZXNzEgRyZWFkEgV3cml0ZRoTCgRpbmZvEgRyZWFkEgV3cml0ZRoXCghpbnZvaWNlcxIEcmVhZBIFd3JpdGUaFgoHbWVzc2FnZRIEcmVhZBIFd3JpdGUaFwoIb2ZmY2hhaW4SBHJlYWQSBXdyaXRlGhYKB29uY2hhaW4SBHJlYWQSBXdyaXRlGhQKBXBlZXJzEgRyZWFkEgV3cml0ZRoSCgZzaWduZXISCGdlbmVyYXRlAAAGIHhpARhP5VRs9TJo22uZYfUwhPoWvjGCD+ZRRtqY1V4s',
  socket: '127.0.0.1:10009' // '34.66.56.153:10009'
})

;(async function main() {
  try {
    /**
     * 1. List All Active Payment Channels
     */
    if (args.includes('--listChannels')) {
      let listChannelsRes = await listChannels({ active_only: true, public_only: true })
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

    // B. Get Peers
    if (args.includes('--getPeers')) {
      let getPeersRes = await lnService.getPeers({ lnd })
      console.log('====================================')
      console.log('All Peer Connections:\n', getPeersRes)
      console.log('====================================')
    }
  } catch (error) {
    console.error('Error: ', error)
    process.exit(1)
  }

  process.exit(0)
})()
