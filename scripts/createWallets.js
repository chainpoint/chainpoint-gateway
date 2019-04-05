const ethers = require('ethers')

async function generateWallets() {
  let w = ethers.Wallet.createRandom({ extraEntropy: ethers.utils.formatBytes32String(`${Date.now()}`) })
  let wallet = { address: w.address, privateKey: w.privateKey }
  console.log(JSON.stringify(wallet))
}

generateWallets()
