const fs = require('fs')
const path = require('path')
const envfile = require('envfile')

async function updateOrCreateEnv(blacklist, valuePairs) {
  const valuePairsClone = JSON.parse(JSON.stringify(valuePairs))
  // Prevent blacklisted keys from being persisted to .env
  blacklist.forEach(currVal => delete valuePairs[currVal])
  if (fs.existsSync(path.resolve(__dirname, '../../', '.env'))) {
    let env = envfile.parseFileSync(path.resolve(__dirname, '../../', '.env'))

    fs.writeFileSync(
      path.resolve(__dirname, '../../', '.env'),
      envfile.stringifySync(Object.assign({}, env, valuePairs))
    )
  } else {
    // .env has yet to be created, create from .env.sample
    let env = envfile.parseFileSync(path.resolve(__dirname, '../../', '.env.sample'))

    fs.writeFileSync(
      path.resolve(__dirname, '../../', '.env'),
      envfile.stringifySync(Object.assign({}, env, valuePairs))
    )
  }
  return Promise.resolve(valuePairsClone)
}

async function readEnv() {
  if (fs.existsSync(path.resolve(__dirname, '../../', '.env'))) {
    return envfile.parseFileSync(path.resolve(__dirname, '../../', '.env'))
  } else {
    return {}
  }
}

module.exports = updateOrCreateEnv
module.exports.updateOrCreateEnv = updateOrCreateEnv
module.exports.readEnv = readEnv
