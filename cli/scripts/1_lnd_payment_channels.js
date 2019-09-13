const fs = require('fs')
const path = require('path')
const lnService = require('ln-service')
const lightning = require('lnrpc-node-client')
const homedir = require('os').homedir()
// const env = require('../../lib/parse-env').env

function toBase64(file) {
  var body = fs.readFileSync(file)
  return body.toString('base64').replace(/\s/g, '')
}

async function openChannelToCore(opts) {
  console.log('====================================')
  console.log('openChannelToCore -> opts', JSON.stringify(opts))
  console.log('====================================')

  lightning.setCredentials(
    '127.0.0.1:10009',
    path.resolve(homedir, '.lnd/data/chain/bitcoin/testnet/admin.macaroon'),
    path.resolve(homedir, '.lnd/tls.cert')
  )

  // TODO: use dynamic base64 method to encode cert and macaroon
  const { lnd } = lnService.authenticatedLndGrpc({
    cert: opts.tlscert,
    macaroon: opts.macaroon,
    socket: '127.0.0.1:10009' // '34.66.56.153:10009'
  })

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
