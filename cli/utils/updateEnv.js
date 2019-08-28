const fs = require('fs')
const envfile = require('envfile')

async function updateOrCreateEnv(blacklist, valuePairs) {
  const valuePairsClone = JSON.parse(JSON.stringify(valuePairs))
  // Prevent blacklisted keys from being persisted to .env
  blacklist.forEach(currVal => delete valuePairs[currVal])
  if (fs.existsSync('.env')) {
    let env = envfile.parseFileSync('.env')

    fs.writeFileSync('.env', envfile.stringifySync(Object.assign({}, env, valuePairs)))
  } else {
    // .env has yet to be created, create from .env.sample
    let env = envfile.parseFileSync('.env.sample')

    fs.writeFileSync('.env', envfile.stringifySync(Object.assign({}, env, valuePairs)))
  }
  return Promise.resolve(valuePairsClone)
}

async function readEnv() {
  if (fs.existsSync('.env')) {
    return envfile.parseFileSync('.env')
  } else {
    return {}
  }
}

module.exports = updateOrCreateEnv
module.exports.updateOrCreateEnv = updateOrCreateEnv
module.exports.readEnv = readEnv
