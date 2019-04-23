const exec = require('executive')
const chalk = require('chalk')

async function createDockerSecrets(wallet) {
  try {
    await exec.quiet([
      `printf ${wallet.address} | docker secret create NODE_ETH_ADDRESS -`,
      `printf ${wallet.privateKey} | docker secret create NODE_ETH_PRIVATE_KEY -`,
      `echo ${wallet.address} > eth-address.txt`
    ])

    return wallet
  } catch (err) {
    console.log(chalk.red('Error creating Docker secrets for ETH_ADDRESS & ETH_PRIVATE_KEY'))

    return Promise.reject(err)
  }
}

module.exports = createDockerSecrets
