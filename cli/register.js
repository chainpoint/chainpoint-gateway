const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const { pipeP } = require('ramda')
const inquirer = require('inquirer')
const cliHelloLogger = require('./utils/cliHelloLogger')
const stakingQuestions = require('./utils/stakingQuestions')
const updateOrCreateEnv = require('./scripts/1_update_env')

async function main() {
  cliHelloLogger()

  console.log(fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_ADDRESS'), 'utf-8'))

  console.log(chalk.bold.yellow('Stake your Node:'))

  try {
    await pipeP(
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

    console.log(chalk.green('\n===================================='))
    console.log(chalk.green('==   SUCCESSFULLY STAKED NODE!    =='))
    console.log(chalk.green('====================================', '\n'))
  } catch (error) {
    console.log(chalk.red('Failed to Stake Node to Chainpoint Network. Please try again.'))
  }
}

main().then(() => {
  process.exit(0)
})
