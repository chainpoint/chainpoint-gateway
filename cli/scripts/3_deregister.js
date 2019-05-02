const fs = require('fs')
const path = require('path')
const ethers = require('ethers')
const Web3 = require('web3')

const web3 = new Web3(new Web3.providers.HttpProvider(`https://ropsten.infura.io/v3/foobar`))

let regDefinition = require('../../artifacts/ethcontracts/ChainpointRegistry.json')

const ChainpointRegistryABI = regDefinition.abi
const registryAddress = regDefinition.networks['3'].address
const chainId = 3
const privateKey = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_PRIVATE_KEY'), 'utf8')

const wallet = new ethers.Wallet(privateKey)
const registryContract = web3.eth.Contract(ChainpointRegistryABI, registryAddress)

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

    const funcSigEncoded = registryContract.methods.unStake().encodeABI()
    console.log(JSON.stringify(txData), 'deregister txData')
    const tx = {
      gasPrice: txData.gasPrice + (retryCount - 1),
      gasLimit: 185000,
      data: funcSigEncoded,
      to: registryAddress,
      nonce: txData.transactionCount,
      chainId: parseInt(chainId, 10)
    }

    return wallet.sign(tx)
  }
}

module.exports.deregister = deregister
