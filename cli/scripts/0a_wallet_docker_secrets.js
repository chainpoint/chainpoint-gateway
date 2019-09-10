const exec = require('executive')
const chalk = require('chalk')
const _ = require('lodash')
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

async function deleteSecrets(secrets = []) {
  for (let i = 0; i < secrets.length; i++) {
    const secret = secrets[i]

    try {
      // Delete Secrets
      await exec.quiet([`docker secret rm ${secret}`])

      let result = await find(secret)
      if (!_.isEmpty(result)) {
        throw new Error(`Docker Secret (${secret}) was NOT deleted`)
      }
    } catch (err) {
      console.error(`Error attempting to delete Docker Secret: ${secret}`)

      return Promise.reject(err)
    }
  }
}

function createWalletAndDockerSecrets(force = false, secretsMap) {
  return async function() {
    try {
      if (force) await deleteSecrets(Object.keys(secretsMap))

      Object.keys(secretsMap).forEach(async currKey => {
        await findOrCreate({ key: currKey, val: secretsMap[currKey] })
      })

      return secretsMap
    } catch (err) {
      console.log(chalk.red(`Error creating Docker secrets for ${JSON.stringify(Object.keys(secretsMap))}`))

      return Promise.reject(err)
    }
  }
}

module.exports = createWalletAndDockerSecrets
