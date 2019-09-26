const lnService = require('ln-service')
const lightning = require('lnrpc-node-client')
const homedir = require('os').homedir()
const utils = require('../../lib/utils')
const env = require('../../lib/parse-env').env

async function openChannelToCore(opts) {
  const LND_SOCKET = '127.0.0.1:10009'
  const LND_CERTPATH = `${homedir}/.lnd/chainpoint-node/tls.cert`
  const LND_MACAROONPATH = `${homedir}/.lnd/chainpoint-node/data/chain/bitcoin/${env.NETWORK}/admin.macaroon`

  console.log('====================================')
  console.log('openChannelToCore -> opts', JSON.stringify(opts))
  console.log('====================================')

  lightning.setCredentials(LND_SOCKET, LND_MACAROONPATH, LND_CERTPATH)

  const { lnd } = lnService.authenticatedLndGrpc({
    cert: utils.toBase64(LND_CERTPATH),
    macaroon: utils.toBase64(LND_MACAROONPATH),
    socket: LND_SOCKET
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
