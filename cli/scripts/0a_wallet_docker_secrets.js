const exec = require('executive')
const chalk = require('chalk')
const _ = require('lodash')
const createWallet = require('./0_create_wallet')
const { readEnv } = require('./1_update_env')

async function find(secret) {
  try {
    let result = await exec.quiet([`docker secret inspect ${secret}`])
    let parsedResult = JSON.parse(result.stdout.replace(/\n/g, ''))

    return parsedResult
  } catch (err) {
    console.log(chalk.red('Error reading Docker secrets before creating ETH_ADDRESS & ETH_PRIVATE_KEY'))

    return Promise.reject(err)
  }
}

async function findOrCreate(obj) {
  let env = await readEnv()

  try {
    let result = await find(obj.key)
    if (_.isEmpty(result)) {
      let cmds = [`printf ${obj.val} | docker secret create ${obj.key} -`]
      if (obj.key === 'NODE_ETH_ADDRESS') cmds.push(`echo ${obj.val} > eth-address.txt`)

      await exec.quiet(cmds)

      return obj.val
    } else {
      return env[obj.key] || ''
    }
  } catch (err) {
    console.log(chalk.red(`Error creating Docker Secret: ${obj.key} `))

    return Promise.reject(err)
  }
}

async function createDockerSecrets() {
  try {
    let conditionalWallet = await createWallet()
    let w = {}

    w.address = await findOrCreate({ key: 'NODE_ETH_ADDRESS', val: conditionalWallet.address })
    w.privateKey = await findOrCreate({ key: 'NODE_ETH_PRIVATE_KEY', val: conditionalWallet.privateKey })

    return w
  } catch (err) {
    console.log(chalk.red('Error creating Docker secrets for ETH_ADDRESS & ETH_PRIVATE_KEY'))

    return Promise.reject(err)
  }
}

module.exports = createDockerSecrets
