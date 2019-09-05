const path = require('path')
const lnService = require('ln-service')
const lightning = require('lnrpc-node-client')
const homedir = require('os').homedir()

lightning.setCredentials(
  '127.0.0.1:10009',
  path.resolve(homedir, '.lnd/data/chain/bitcoin/testnet/admin.macaroon'),
  path.resolve(homedir, '.lnd/tls.cert')
)

// TODO: use dynamic base64 method to encode cert and macaroon
const { lnd } = lnService.authenticatedLndGrpc({
  cert:
    'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUI2ekNDQVpDZ0F3SUJBZ0lRWDk4VTB4eHh1NkpacnM3dUxCcStVakFLQmdncWhrak9QUVFEQWpBNE1SOHcKSFFZRFZRUUtFeFpzYm1RZ1lYVjBiMmRsYm1WeVlYUmxaQ0JqWlhKME1SVXdFd1lEVlFRREV3eGxaVGN5TURGawpZbVEzTkdRd0hoY05NVGt3T1RBek1qRXlPRFE0V2hjTk1qQXhNREk0TWpFeU9EUTRXakE0TVI4d0hRWURWUVFLCkV4WnNibVFnWVhWMGIyZGxibVZ5WVhSbFpDQmpaWEowTVJVd0V3WURWUVFERXd4bFpUY3lNREZrWW1RM05HUXcKV1RBVEJnY3Foa2pPUFFJQkJnZ3Foa2pPUFFNQkJ3TkNBQVRwc3VVc0p6WWJSZzZHUGRteVRTd1ZtRHg0STNPRwp0bTdjcCtLMG5VL2ZlR3FrRVA5dGo2VnJTeE96TEZtOXNMaDdSNGpYWW85NkNReHQ3b3lKR1hUa28zd3dlakFPCkJnTlZIUThCQWY4RUJBTUNBcVF3RHdZRFZSMFRBUUgvQkFVd0F3RUIvekJYQmdOVkhSRUVVREJPZ2d4bFpUY3kKTURGa1ltUTNOR1NDQ1d4dlkyRnNhRzl6ZElJRGJHNWtnZ1IxYm1sNGdncDFibWw0Y0dGamEyVjBod1IvQUFBQgpoeEFBQUFBQUFBQUFBQUFBQUFBQUFBQUJod1NzR0FBQ01Bb0dDQ3FHU000OUJBTUNBMGtBTUVZQ0lRRG45TzhlCjdOS054ZUg0N3hUVjRMT0Y4L2l0Mm55UHUrbEs3Q0FURC9abzVBSWhBTlRmQVhtdGZsOFVRZjFSbEFKc1UvdS8KeFlCbTZQb1JzYXhPMzFYRVhmS0oKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=',
  macaroon:
    'AgEDbG5kAs8BAwoQMzls1mNheD4W+uWJ27Q66hIBMBoWCgdhZGRyZXNzEgRyZWFkEgV3cml0ZRoTCgRpbmZvEgRyZWFkEgV3cml0ZRoXCghpbnZvaWNlcxIEcmVhZBIFd3JpdGUaFgoHbWVzc2FnZRIEcmVhZBIFd3JpdGUaFwoIb2ZmY2hhaW4SBHJlYWQSBXdyaXRlGhYKB29uY2hhaW4SBHJlYWQSBXdyaXRlGhQKBXBlZXJzEgRyZWFkEgV3cml0ZRoSCgZzaWduZXISCGdlbmVyYXRlAAAGIORO3mylhqXeQH+gXz/siembaqdAvYSM9RJOPWiLYTNG',
  socket: '127.0.0.1:10009' // '34.66.56.153:10009'
})

async function openChannelToCore(opts) {
  try {
    let openChannelRes = await lnService.openChannel({
      lnd,
      partner_public_key: opts.pubkey,
      local_tokens: opts.satoshis
    })

    console.log('Opened Payment Channel -> ' + opts.pubkey)

    return Object.assign({}, opts, openChannelRes)
  } catch (error) {
    console.warn(`Unable to open payment channel with Core: ${opts.pubkey} : ${JSON.stringify(error)}`)
    return Promise.reject(error)
  }
}

module.exports = openChannelToCore
