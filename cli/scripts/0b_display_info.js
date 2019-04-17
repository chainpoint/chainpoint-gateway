const chalk = require('chalk')

async function displayWalletInfo(wallet) {
  console.log(chalk.bold.white('    Address:'))
  console.log(chalk.gray('   ', wallet.address))

  console.log(chalk.bold.white('\n    Private Key:'))
  console.log(chalk.gray('   ', wallet.privateKey))

  console.log(chalk.bold.yellow('\n\nNext Steps:'))
  console.log(
    chalk.white(
      `  a) PLEASE SEND 5000 TNT TO YOUR NEW ADDRESS (${chalk.bold.gray(
        wallet.address
      )}) IN ORDER TO REGISTER, THEN RUN "make register"\n`
    )
  )
}

module.exports = displayWalletInfo
module.exports.displayWalletInfo = displayWalletInfo
