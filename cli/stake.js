const chalk = require('chalk')
const { pipeP } = require('ramda')
const inquirer = require('inquirer')
const cliHelloLogger = require('./utils/cliHelloLogger')
const stakingQuestions = require('./utils/stakingQuestions')
const updateOrCreateEnv = require('./scripts/1_update_env')

async function main() {
  cliHelloLogger()

  console.log(chalk.bold.yellow('Stake your Node:'))

  try {
    await pipeP(
      () =>
        inquirer.prompt([
          stakingQuestions['NODE_ETH_REWARDS_ADDRESS'],
          stakingQuestions['AUTO_ACQUIRE_ENABLED'],
          stakingQuestions['AUTO_ACQUIRE_AMOUNT']
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
