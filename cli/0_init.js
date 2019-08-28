const chalk = require('chalk')
const { pipe, pipeP } = require('ramda')
const { isEmpty } = require('lodash')
const ora = require('ora')
const tap = require('./utils/tap')
const cliHelloLogger = require('./utils/cliHelloLogger')
const createWalletAndDockerSecrets = require('./scripts/0a_wallet_docker_secrets')
const displayWalletInfo = require('./scripts/0b_display_info')
const updateOrCreateEnv = require('./scripts/1_update_env')

const spinner = ora(chalk.bold.yellow('New Wallet:\n'))

const resolve = Promise.resolve.bind(Promise)
const toBoolean = b => {
  if (b === true || b === 'true') return true
  else return false
}

const args = process.argv
  .slice(2)
  .map(currVal => {
    let kv = currVal.split('=')

    return { [kv[0]]: kv[1] }
  })
  .filter(currVal => !isEmpty(currVal[Object.keys(currVal)[0]]))
  .reduce((acc, currVal) => {
    return Object.assign({}, acc, currVal)
  }, {})

async function main() {
  cliHelloLogger()

  await pipeP(
    tap(spinner.start.bind(spinner), resolve),
    createWalletAndDockerSecrets(toBoolean(args['FORCE'])),
    tap(
      pipe(
        currVal => ({
          NODE_ETH_ADDRESS: currVal.address
        }),
        updateOrCreateEnv
      ),
      resolve
    ),
    tap(w => {
      spinner.succeed(chalk.bold.yellow(`${w.privateKey !== '' ? 'New' : 'Existing'} Wallet:\n`))
    }, resolve),
    displayWalletInfo
  )()
}

main()
