const ethers = require('ethers')

async function createWallet() {
  return ethers.Wallet.createRandom({
    extraEntropy: ethers.utils.formatBytes32String(`${Date.now()}`)
  })
}

module.exports = createWallet
module.exports.createWallet = createWallet
