const path = require('path')
const lnService = require('ln-service')
const lightning = require('lnrpc-node-client')
const homedir = require('os').homedir()

// let env = require('../../lib/parse-env').env
// let { connectAsync, getAllCoreIPs } = require('../../lib/cores')

// const hotWalletPassword = fs.readFileSync('/run/secrets/hot_wallet_pass', 'utf8')
// const hotWalletAddress = fs.readFileSync('/run/secrets/hot_wallet_addr', 'utf8')

lightning.setCredentials(
  '127.0.0.1:10009',
  path.resolve(homedir, '.lnd/data/chain/bitcoin/testnet/admin.macaroon'),
  path.resolve(homedir, '.lnd/tls.cert')
)

// TODO: use dynamic base64 method to encode cert and macaroon
const { lnd } = lnService.authenticatedLndGrpc({
  cert:
    'LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0tCk1JSUI2ekNDQVpHZ0F3SUJBZ0lSQVBnZ1RQWlp2VDZKRzVVaWZTblc1cmd3Q2dZSUtvWkl6ajBFQXdJd09ERWYKTUIwR0ExVUVDaE1XYkc1a0lHRjFkRzluWlc1bGNtRjBaV1FnWTJWeWRERVZNQk1HQTFVRUF4TU1Oemd4TmpNeApZMk5tTmpnNU1CNFhEVEU1TURneU9ESXdNRFV5TmxvWERUSXdNVEF5TWpJd01EVXlObG93T0RFZk1CMEdBMVVFCkNoTVdiRzVrSUdGMWRHOW5aVzVsY21GMFpXUWdZMlZ5ZERFVk1CTUdBMVVFQXhNTU56Z3hOak14WTJObU5qZzUKTUZrd0V3WUhLb1pJemowQ0FRWUlLb1pJemowREFRY0RRZ0FFUDZaWXYzZ0dIaUI3a2d3WTFTVkVITXQvMzFSSApqM2lMRWNvMXN6RnYzdmZZRktKazZlRUVMUVRiTlRYU2doNzZmOEVCbDNhMnNrR2dkV1didE9rYVo2TjhNSG93CkRnWURWUjBQQVFIL0JBUURBZ0trTUE4R0ExVWRFd0VCL3dRRk1BTUJBZjh3VndZRFZSMFJCRkF3VG9JTU56Z3gKTmpNeFkyTm1Oamc1Z2dsc2IyTmhiR2h2YzNTQ0EyeHVaSUlFZFc1cGVJSUtkVzVwZUhCaFkydGxkSWNFZndBQQpBWWNRQUFBQUFBQUFBQUFBQUFBQUFBQUFBWWNFckJZQUFqQUtCZ2dxaGtqT1BRUURBZ05JQURCRkFpRUF6ckhxCktEZld0VGxmenJEV3h0VVFJTUJGTDJUZGVESGZlbnpseTNMMEVTWUNJQVh2VVljR3ZtQTN6K1JMY1o2S1MzL3UKVGcvclZ1SjFtQlZ3RHZzWEg4cGUKLS0tLS1FTkQgQ0VSVElGSUNBVEUtLS0tLQo=',
  macaroon:
    'AgEDbG5kAs8BAwoQxOf30XsdqZ6VCg6dwXdw+BIBMBoWCgdhZGRyZXNzEgRyZWFkEgV3cml0ZRoTCgRpbmZvEgRyZWFkEgV3cml0ZRoXCghpbnZvaWNlcxIEcmVhZBIFd3JpdGUaFgoHbWVzc2FnZRIEcmVhZBIFd3JpdGUaFwoIb2ZmY2hhaW4SBHJlYWQSBXdyaXRlGhYKB29uY2hhaW4SBHJlYWQSBXdyaXRlGhQKBXBlZXJzEgRyZWFkEgV3cml0ZRoSCgZzaWduZXISCGdlbmVyYXRlAAAGINugXEQBtEwf+zeDENMPuNNL0UzRbjWorXcQsPO12hq0',
  socket: '127.0.0.1:10009' // '34.66.56.153:10009'
})

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
