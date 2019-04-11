const fs = require('fs')
const path = require('path')
// const chalk = require('chalk')
const { pipeP, thunkify } = require('ramda')
const ethers = require('ethers')
const ipToInt = require('ip-to-int')
const { getETHStatsByAddressAsync, broadcastEthTxAsync } = require('../../lib/cores')
// const tap = require('./utils/tap')

// const ChainpointRegistryABI = require('../../artifacts/ethcontracts/ChainpointRegistry.json').abi
const TierionNetworkTokenABI = require('../../artifacts/ethcontracts/TierionNetworkToken.json').abi
const tokenAddress = fs.readFileSync(path.resolve('../../artifacts/ethcontracts/token.txt', 'utf8'))
const registryAddress = fs.readFileSync(path.resolve('../../artifacts/ethcontracts/token.txt', 'utf8'))

// const privateKey = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_PRIVATE_KEY', 'utf8'))
const privateKey = 'super private key...'
const wallet = new ethers.Wallet(privateKey)

async function approve(
  txData = {
    gasPrice: 2000000000,
    nonce: 0
  }
) {
  const tokenInterface = new ethers.Interface(TierionNetworkTokenABI)
  const funcSigEncoded = tokenInterface.functions.approve(registryAddress, 500000000000)

  const tx = {
    gasPrice: txData.gasPrice,
    gasLimit: 185000,
    data: funcSigEncoded.data,
    to: tokenAddress,
    nonce: txData.nonce
  }

  return wallet.sign(tx)
}

async function register([txData, registrationParams]) {
  const registryInterface = new ethers.Interface(TierionNetworkTokenABI)
  const funcSigEncoded = registryInterface.functions.stake(
    ipToInt(registrationParams.NODE_PUBLIC_IP_ADDRESS).toInt(),
    wallet.publicKey
  )

  const tx = {
    gasPrice: txData.gasPrice,
    gasLimit: 185000,
    data: funcSigEncoded.data,
    to: tokenAddress,
    nonce: txData.nonce
  }

  return wallet.sign(tx)
}

module.exports.register = register
module.exports.approve = pipeP(
  thunkify(getETHStatsByAddressAsync)(wallet.address),
  approve,
  broadcastEthTxAsync
)
