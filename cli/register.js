const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const { isEmpty, has } = require('lodash')
const { pipeP } = require('ramda')
const inquirer = require('inquirer')
const cliHelloLogger = require('./utils/cliHelloLogger')
const stakingQuestions = require('./utils/stakingQuestions')
const updateOrCreateEnv = require('./scripts/1_update_env')
const { approve, register } = require('./scripts/2_registration')
const { connectAsync, getETHStatsByAddressAsync, broadcastEthTxAsync } = require('../lib/cores')

const ethAddress = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_ADDRESS'), 'utf8')

let getETHStatsByAddressDefault = (function(v) {
  return function(a) {
    return getETHStatsByAddressAsync(v, a)
  }
})(false)

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

const joinArgs = (function(args = {}) {
  return function(valuePairs) {
    return Promise.resolve(Object.assign({}, args, valuePairs))
  }
})(args)

async function main() {
  cliHelloLogger()

  await connectAsync()

  console.log(chalk.bold.yellow('Stake your Node:'))

  try {
    let registrationParams = await pipeP(
      () =>
        inquirer.prompt(
          ['NODE_ETH_REWARDS_ADDRESS', 'NODE_PUBLIC_IP_ADDRESS', 'AUTO_REFILL_ENABLED', 'AUTO_REFILL_AMOUNT']
            .filter(currVal => !has(args, currVal))
            .map(q => stakingQuestions[q])
        ),
      joinArgs,
      updateOrCreateEnv
    )()

    // Create & broadcast `approve()` Tx
    await pipeP(
      getETHStatsByAddressDefault,
      approve,
      broadcastEthTxAsync
    )(ethAddress)

    // Create & broadcast `stake()` Tx
    let txData = await getETHStatsByAddressDefault(ethAddress)
    await pipeP(
      register,
      broadcastEthTxAsync
    )([txData, registrationParams])

    console.log(chalk.green('\n======================================'))
    console.log(chalk.green('==   SUCCESSFULLY REGISTERED NODE!  =='))
    console.log(chalk.green('======================================', '\n'))
  } catch (error) {
    console.log(chalk.red('Failed to Stake Node to Chainpoint Network. Please try again. ' + error.message))
  }
}

main().then(() => {
  process.exit(0)
})
