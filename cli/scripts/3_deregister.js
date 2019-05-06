// load environment variables
let env = require('../../lib/parse-env.js').env

const fs = require('fs')
const path = require('path')
const ethers = require('ethers')

let regDefinition = require('../../artifacts/ethcontracts/ChainpointRegistry.json')

const ChainpointRegistryABI = regDefinition.abi
const network = env.NODE_ENV === 'production' ? 'homestead' : 'ropsten'
const chainId = network === 'homestead' ? '1' : '3'
const registryAddress = regDefinition.networks[chainId].address
const privateKey = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_PRIVATE_KEY'), 'utf8')

const wallet = new ethers.Wallet(privateKey)
const regContractInterface = new ethers.utils.Interface(ChainpointRegistryABI)

function deregister(retryCount = 1) {
  return async function(txData) {
    // Validate txData.registration before returning a raw ETH Tx, if not able to deregister, throw
    // Make sure Node is registered
    if (!txData.registration.isStaked) {
      throw new Error("You cannot deregister as the Node's ETH Address is not registered in the Chainpoint Registry")
    }
    // Make sure Node's $TKNS are no longer timelocked
    // Date.now() returns milliseconds as where Solidity's block.timestamp returns seconds
    if (Math.floor(Date.now() / 1000) < txData.registration.stakeLockedUntil) {
      throw new Error(
        `You cannot deregister as the tokens staked are timelocked. You'll be able to deregister after ${
          txData.registration.stakeLockedUntil
        } has elapsed.`
      )
    }

    let functionInfo = regContractInterface.functions.unStake
    let functionData = functionInfo.encode([])
    console.log(JSON.stringify(txData), 'deregister txData')
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

module.exports.deregister = deregister
