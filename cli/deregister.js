const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
// const { isEmpty, has } = require('lodash')
const { pipeP } = require('ramda')
const cliHelloLogger = require('./utils/cliHelloLogger')
const { deregister } = require('./scripts/3_deregister')
const { connectAsync, getETHStatsByAddressAsync, broadcastEthTxAsync } = require('../lib/cores')

const ethAddress = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_ADDRESS'), 'utf8')

let getETHStatsByAddressVerbose = (function(v) {
  return function(a) {
    return getETHStatsByAddressAsync(v, a)
  }
})(true)

async function main() {
  cliHelloLogger()

  await connectAsync()

  console.log(chalk.bold.yellow('De-registering your Node:'))

  let deregisterResult = await pipeP(
    getETHStatsByAddressVerbose,
    deregister,
    broadcastEthTxAsync
  )(ethAddress)

  return deregisterResult
}

main()
  .then(() => {
    console.log(chalk.green('\n========================================'))
    console.log(chalk.green('==   SUCCESSFULLY DE-REGISTERED NODE!  =='))
    console.log(chalk.green('========================================', '\n'))

    process.exit(0)
  })
  .catch(err => {
    console.log(chalk.red('\n===================================='))
    console.log(chalk.red('==   FAILED TO DE-REGISTERE NODE!   =='))
    console.log(chalk.red('===================================='))
    console.log(chalk.red('Reason:\n' + err.message))

    process.exit(1)
  })
