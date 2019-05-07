// load environment variables
let env = require('../../lib/parse-env.js').env

const fs = require('fs')
const path = require('path')
const ethers = require('ethers')
const ipToInt = require('ip-to-int')

let regDefinition = require('../../artifacts/ethcontracts/ChainpointRegistry.json')

const ChainpointRegistryABI = regDefinition.abi
const network = env.NODE_ENV === 'production' ? 'homestead' : 'ropsten'
const chainId = network === 'homestead' ? '1' : '3'
const registryAddress = regDefinition.networks[chainId].address
const privateKey = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_PRIVATE_KEY'), 'utf8')

const wallet = new ethers.Wallet(privateKey)
const regContractInterface = new ethers.utils.Interface(ChainpointRegistryABI)

function updateRegistration(retryCount = 1) {
  return async function([txData, registrationParams]) {
    // Validate txData.registration before returning a raw ETH Tx, if not able to deregister, throw
    // Make sure Node is registered
    if (!txData.registration.isStaked) {
      throw new Error(
        "You cannot update the registration as the Node's ETH Address is not registered in the Chainpoint Registry"
      )
    }

    let functionInfo = regContractInterface.functions.updateStake
    let functionData = functionInfo.encode([ipToInt(registrationParams.NODE_PUBLIC_IP_ADDRESS).toInt()])
    console.log(JSON.stringify(txData), 'updateRegistration txData')
    const tx = {
      gasPrice: txData.gasPrice + (retryCount - 1),
      gasLimit: 185000,
      data: functionData,
      to: registryAddress,
      nonce: txData.transactionCount,
      chainId: parseInt(chainId, 10)
    }

    return wallet.sign(tx)
  }
}

module.exports.updateRegistration = updateRegistration
