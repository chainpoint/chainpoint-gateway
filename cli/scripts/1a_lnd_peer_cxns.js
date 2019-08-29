const path = require('path')
const lightning = require('lnrpc-node-client')
const { isEmpty } = require('lodash')
const { pipeP } = require('ramda')
const homedir = require('os').homedir()
const { buildRequestOptions, coreRequestAsync } = require('../../lib/cores')

lightning.setCredentials(
  '127.0.0.1:10009',
  path.resolve(homedir, '.lnd/data/chain/bitcoin/testnet/admin.macaroon'),
  path.resolve(homedir, '.lnd/tls.cert')
)

async function getCoreStatus(coreIP) {
  try {
    let getStatusOptions = buildRequestOptions(null, 'GET', '/status')
    let coreResponse = await coreRequestAsync(getStatusOptions, coreIP, 0)

    const getLNDHost = (res => {
      if (!res.uris.length) return coreIP

      try {
        let ip = coreResponse.uris[0].split('@')[1]
        return ip ? ip : coreIP
      } catch (_) {
        return coreIP
      }
    })()

    return {
      host: `${getLNDHost(coreResponse)}:10009`,
      pubkey: coreResponse.public_key
    }
  } catch (_) {
    return undefined
  }
}

const connectPeer = opts => {
  if (isEmpty(opts)) Promise.reject(false)

  return new Promise((resolve, reject) => {
    lightning.lightning().connectPeer({ addr: opts }, (err, res) => {
      if (err) reject(false)
      else resolve({ res, peer: opts })
    })
  })
}

module.exports = coreIPs => {
  return Promise.all(
    coreIPs.map(currVal =>
      pipeP(
        getCoreStatus,
        connectPeer
      )(currVal)
    )
  ).catch(() => {})
}
