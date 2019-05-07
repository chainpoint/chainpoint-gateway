const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const { isEmpty, has } = require('lodash')
const { pipeP } = require('ramda')
const inquirer = require('inquirer')
const retry = require('async-retry')
const cliHelloLogger = require('./utils/cliHelloLogger')
const stakingQuestions = require('./utils/stakingQuestions')
const updateOrCreateEnv = require('./scripts/1_update_env')
const { updateRegistration } = require('./scripts/3_update_registration')
const { connectAsync, getETHStatsByAddressAsync, broadcastEthTxAsync } = require('../lib/cores')

const ethAddress = fs.readFileSync(path.resolve('/run/secrets/NODE_ETH_ADDRESS'), 'utf8')

let getETHStatsByAddressVerbose = (function(v) {
  return function(a) {
    return getETHStatsByAddressAsync(v, a)
  }
})(true)

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

  console.log(chalk.bold.yellow("Updating Node's Registration:"))

  try {
    let registrationParams = await pipeP(
      () =>
        inquirer.prompt(
          ['NODE_PUBLIC_IP_ADDRESS'].filter(currVal => !has(args, currVal)).map(q => stakingQuestions[q])
        ),
      joinArgs,
      updateOrCreateEnv
    )()

    // Create & broadcast `stake()` Tx
    // Apply retry logic which will retry the entire series of steps
    await retry(
      async (bail, retryCount) => {
        try {
          let txData = await getETHStatsByAddressVerbose(ethAddress)
          let result = await pipeP(
            updateRegistration(retryCount),
            broadcastEthTxAsync
          )([txData, registrationParams])

          console.log(result, 'updateRegistration -> result')
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
          console.log(
            `INFO : Node RegistrationUpdate : ${error.statusCode || 'no response'} : ${error.message} : retrying`
          )
        }
      }
    )

    console.log(chalk.green('\n==========================================='))
    console.log(chalk.green('==   SUCCESSFULLY UPDATED REGISTRATION!  =='))
    console.log(chalk.green('===========================================', '\n'))
  } catch (error) {
    console.log(chalk.red('Failed to Update Registration. Please try again. ' + error.message))
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(err => {
    console.error(err.message)
    process.exit(1)
  })
