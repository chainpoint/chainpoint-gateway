const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const retry = require('async-retry')
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

  // Create & broadcast `approve()` Tx
  // Apply retry logic which will retry the entire series of steps
  await retry(
    async (bail, retryCount) => {
      try {
        await pipeP(
          getETHStatsByAddressVerbose,
          deregister(retryCount),
          broadcastEthTxAsync
        )(ethAddress)
      } catch (error) {
        // If no response was received or there is a status code >= 500, then we should retry the call, throw an error
        if (!error.statusCode || error.statusCode >= 500) throw error
        // errors like 409 Conflict or 400 Bad Request are not retried because the request is bad and will never succeed
        bail(error)
      }
    },
    {
      retries: 3, // The maximum amount of times to retry the operation. Default is 3
      factor: 1, // The exponential factor to use. Default is 2
      minTimeout: 1000, // The number of milliseconds before starting the first retry. Default is 200
      maxTimeout: 1500,
      onRetry: error => {
        console.log(`INFO : Node De-registration : ${error.statusCode || 'no response'} : ${error.message} : retrying`)
      }
    }
  )
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
    console.log(chalk.red('==   FAILED TO DE-REGISTER NODE!  =='))
    console.log(chalk.red('===================================='))
    console.log(chalk.red('Reason:\n' + err.message))

    process.exit(1)
  })
