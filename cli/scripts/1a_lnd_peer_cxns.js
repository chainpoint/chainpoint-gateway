const path = require('path')
const lightning = require('lnrpc-node-client')
const { isEmpty } = require('lodash')
const { pipeP } = require('ramda')
const homedir = require('os').homedir()
const { buildRequestOptions, coreRequestAsync } = require('../../lib/cores')

async function getCoreStatus(lndOpts, coreIP) {
  lightning.setCredentials(
    '127.0.0.1:10009',
    path.resolve(homedir, '.lnd/chainpoint-node/data/chain/bitcoin/testnet/admin.macaroon'),
    path.resolve(homedir, '.lnd/chainpoint-node/tls.cert')
  )

  try {
    let getStatusOptions = buildRequestOptions(null, 'GET', '/status')
    let coreResponse = await coreRequestAsync(getStatusOptions, coreIP, 0)

    const getLNDHost = (res => {
      if (!res.uris.length) return coreIP

      try {
        let [ip, port] =
          coreResponse.uris.length && coreResponse.uris[0].split('@').length
            ? [
                coreResponse.uris[0].split('@')[1].split(':')[0] === '127.0.0.1' ||
                coreResponse.uris[0].split('@')[1].split(':')[0] === 'localhost'
                  ? coreIP
                  : coreResponse.uris[0].split('@')[1].split(':')[0],
                coreResponse.uris[0].split('@')[1].split(':')[1]
              ]
            : [coreIP, 10009]
        return ip ? [ip, port] : [coreIP, port]
      } catch (_) {
        return [coreIP, 10009]
      }
    })()

    return {
      host: `${getLNDHost(coreResponse)[0]}:${getLNDHost(coreResponse)[1]}`, // TODO: was getLNDHost(coreResponse)
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

module.exports = (lndOpts, coreIPs) => {
  return Promise.all(
    coreIPs.map(currVal =>
      pipeP(
        getCoreStatus,
        connectPeer
      )(lndOpts, currVal)
    )
  ).catch(() => {})
}
