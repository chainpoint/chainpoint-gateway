const fs = require('fs')
const envfile = require('envfile')

async function updateOrCreateEnv(valuePairs) {
  if (fs.existsSync('.env')) {
    let env = envfile.parseFileSync('.env')

    fs.writeFileSync('.env', envfile.stringifySync(Object.assign({}, env, valuePairs)))

    return Promise.resolve()
  } else {
    // .env has yet to be created, create from .env.sample
    let env = envfile.parseFileSync('.env.sample')

    fs.writeFileSync('.env', envfile.stringifySync(Object.assign({}, env, valuePairs)))
  }
  return Promise.resolve(valuePairs)
}

module.exports = updateOrCreateEnv
module.exports.updateOrCreateEnv = updateOrCreateEnv
