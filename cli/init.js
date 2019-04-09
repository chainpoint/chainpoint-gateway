const chalk = require('chalk')
const { pipe, pipeP } = require('ramda')
const ora = require('ora')
const tap = require('./utils/tap')
const createWallet = require('./scripts/0_create_wallet')
const createDockerSecrets = require('./scripts/0a_wallet_docker_secrets')
const displayWalletInfo = require('./scripts/0b_display_info')
const updateOrCreateEnv = require('./scripts/1_update_env')

const spinner = ora(chalk.bold.yellow('New Wallet:\n'))

const resolve = Promise.resolve.bind(Promise)

async function main() {
  await pipeP(
    tap(spinner.start.bind(spinner), resolve),
    createWallet,
    createDockerSecrets,
    tap(
      pipe(
        currVal => ({
          NODE_ETH_ADDRESS: currVal.address
        }),
        updateOrCreateEnv
      ),
      resolve
    ),
    tap(spinner.succeed.bind(spinner, chalk.bold.yellow('New Wallet:\n')), resolve),
    displayWalletInfo
  )()
}

main()
