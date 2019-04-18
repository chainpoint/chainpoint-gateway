const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const { pipeP } = require('ramda')
const inquirer = require('inquirer')
const cliHelloLogger = require('./utils/cliHelloLogger')
const stakingQuestions = require('./utils/stakingQuestions')
const updateOrCreateEnv = require('./scripts/1_update_env')
const { approve, register } = require('./scripts/2_registration')
const { connectAsync, getETHStatsByAddressAsync, broadcastEthTxAsync } = require('../lib/cores')

const ethAddress = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_ADDRESS'), 'utf8')

async function main() {
  cliHelloLogger()

  await connectAsync()

  console.log(chalk.bold.yellow('Stake your Node:'))

  try {
    let registrationParams = await pipeP(
      () =>
        inquirer.prompt([
          stakingQuestions['NODE_ETH_REWARDS_ADDRESS'],
          stakingQuestions['NODE_PUBLIC_IP_ADDRESS'],
          stakingQuestions['AUTO_REFILL_ENABLED'],
          stakingQuestions['AUTO_REFILL_AMOUNT']
        ]),
      updateOrCreateEnv
      // TODO: /eth/:addr/txdata
      // TODO: /eth/broadcast
    )()

    // Create & broadcast `approve()` Tx
    let approveResult = await pipeP(
      getETHStatsByAddressAsync,
      approve,
      broadcastEthTxAsync
    )(ethAddress)

    console.log('====================================')
    console.log(approveResult, 'approveResult')
    console.log('====================================')

    // Create & broadcast `stake()` Tx
    let txData = await getETHStatsByAddressAsync(ethAddress)
    let stakeResult = await pipeP(
      register,
      broadcastEthTxAsync
    )([txData, registrationParams])

    console.log('====================================')
    console.log(stakeResult, 'approveResult')
    console.log('====================================')
    console.log('\n')

    await console.log(chalk.green('\n===================================='))
    console.log(chalk.green('==   SUCCESSFULLY STAKED NODE!    =='))
    console.log(chalk.green('====================================', '\n'))
  } catch (error) {
    console.log(chalk.red('Failed to Stake Node to Chainpoint Network. Please try again.' + error.message))
  }
}

main().then(() => {
  process.exit(0)
})
