// load environment variables
let env = require('../../lib/parse-env.js').env

const fs = require('fs')
const path = require('path')
const ethers = require('ethers')
const ipToInt = require('ip-to-int')

let tknDefinition = require('../../artifacts/ethcontracts/TierionNetworkToken.json')
let regDefinition = require('../../artifacts/ethcontracts/ChainpointRegistry.json')

const TierionNetworkTokenABI = tknDefinition.abi
const ChainpointRegistryABI = regDefinition.abi
const network = env.NETWORK === 'mainnet' ? 'homestead' : 'ropsten'
const chainId = network === 'homestead' ? '1' : '3'
const tokenAddress = tknDefinition.networks[chainId].address
const registryAddress = regDefinition.networks[chainId].address
const privateKey = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_PRIVATE_KEY'), 'utf8')

const wallet = new ethers.Wallet(privateKey)
const tokenContractInterface = new ethers.utils.Interface(TierionNetworkTokenABI)
const regContractInterface = new ethers.utils.Interface(ChainpointRegistryABI)

function approve(retryCount = 1) {
  return async function(txData) {
    let functionInfo = tokenContractInterface.functions.approve
    let functionData = functionInfo.encode([registryAddress, 500000000000])

    console.log(JSON.stringify(txData), 'approve txData')

    const tx = {
      gasPrice: txData.gasPrice + (retryCount - 1),
      gasLimit: 185000,
      data: functionData,
      to: tokenAddress,
      nonce: txData.transactionCount,
      chainId: parseInt(chainId, 10)
    }

    return wallet.sign(tx)
  }
}

function register(retryCount = 1) {
  return async function([txData, registrationParams]) {
    let functionInfo = regContractInterface.functions.stake
    let functionData = functionInfo.encode([
      ipToInt(registrationParams.NODE_PUBLIC_IP_ADDRESS).toInt(),
      registrationParams.NODE_ETH_REWARDS_ADDRESS
    ])

    console.log(JSON.stringify(txData), 'register txData')

    const tx = {
      gasPrice: txData.gasPrice + (retryCount - 1),
      gasLimit: 185000,
      data: functionData,
      to: registryAddress,
      nonce: txData.transactionCount,
      chainId: parseInt(chainId, 10)
    }

    let rawTx = await wallet.sign(tx)
    console.log(rawTx, 'rawTx')

    return rawTx
  }
}

module.exports.register = register
module.exports.approve = approve
