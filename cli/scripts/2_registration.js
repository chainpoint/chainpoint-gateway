// const fs = require('fs')
// const path = require('path')
// const chalk = require('chalk')
// const { pipe, pipeP } = require('ramda')
// const ethers = require('ethers')
// const tap = require('./utils/tap')

// const ChainpointRegistryABI = require('../../artifacts/ethcontracts/ChainpointRegistry.json').abi
// const TierionNetworkTokenABI = require('../../artifacts/ethcontracts/TierionNetworkToken.json').abi
// const tokenAddress = fs.readFileSync(path.resolve('../../artifacts/ethcontracts/token.txt', 'utf8'))
// const registryAddress = fs.readFileSync(path.resolve('../../artifacts/ethcontracts/token.txt', 'utf8'))

// const privateKey = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_PRIVATE_KEY', 'utf8'))

// async function approve() {}

async function register(registrationParams) {
  console.log('====================================')
  console.dir(registrationParams)
  console.log('====================================')
}

module.exports.register = register
