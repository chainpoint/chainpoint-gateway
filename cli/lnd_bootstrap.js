const chalk = require('chalk')
const { isEmpty, has, uniq } = require('lodash')
const { pipeP, curry, identity } = require('ramda')
const inquirer = require('inquirer')
const cliHelloLogger = require('./utils/cliHelloLogger')
const stakingQuestions = require('./utils/lndBootstrapQuestions')
const tap = require('./utils/tap')
const { updateOrCreateEnv, readEnv } = require('./utils/updateEnv')
const { connectAsync, getAllCoreIPs } = require('../lib/cores')
const createPeerCxns = require('./scripts/1a_lnd_peer_cxns')

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

// Read existing environment variables previously written/set to .env file
const envValues = readEnv()

async function main() {
  cliHelloLogger()

  console.log(chalk.bold.yellow('Bootstrapping LND Configuration:'))

  try {
    let lndBootstrapConfig = await pipeP(
      () =>
        inquirer.prompt(
          [
            'NETWORK',
            'CORE_PAYMENT_CHANNEL_COUNT',
            'CONNECTED_CORE_PAYMENT_CHANNELS_IPS',
            'SATOSHIS_PER_CORE_PAYMENT_CHANNEL'
          ]
            .filter(currVal => !has(args, currVal))
            .map(q => stakingQuestions[q])
        ),
      joinArgs,
      // Map captured config params applying specific validation/concatenation logic
      currVal => {
        if (isEmpty(envValues.CONNECTED_CORE_PAYMENT_CHANNELS_IPS)) return currVal
        else {
          currVal.CONNECTED_CORE_PAYMENT_CHANNELS_IPS = uniq(
            envValues.CONNECTED_CORE_PAYMENT_CHANNELS_IPS.split(',').concat(
              currVal.CONNECTED_CORE_PAYMENT_CHANNELS_IPS.split(',')
            )
          ).join(',')
        }
        return currVal
      },
      tap(
        val => console.log(`Merging existing .env vals and newly capture env input: ${JSON.stringify(val)}`),
        identity
      ),
      curry(updateOrCreateEnv)(['CONNECTED_CORE_PAYMENT_CHANNELS_IPS', 'SATOSHIS_PER_CORE_PAYMENT_CHANNEL'])
    )()

    let paymentChannelResult = await pipeP(
      connectAsync,
      paymentCxnRes => ({ CONNECTED_CORE_PAYMENT_CHANNELS_IPS: paymentCxnRes.ips }),
      tap(val => console.log(`PaymentCxnResult: ${JSON.stringify(val)}`), identity),
      curry(updateOrCreateEnv)([])
    )(lndBootstrapConfig)

    if (envValues.LND_PEER_CONNECTIONS_OPENED !== true) {
      let peerCxnResult = await pipeP(
        createPeerCxns,
        () => ({ LND_PEER_CONNECTIONS_OPENED: true }),
        curry(updateOrCreateEnv)([])
      )(getAllCoreIPs())

      console.log('====================================')
      console.log('peerCxnResult', peerCxnResult)
      console.log('====================================')
    }

    console.log(chalk.green('\n======================================'))
    console.log(chalk.green('==   SUCCESSFULLY BOOTSRAPPED LND CONFIGURATIONS!  =='))
    console.log(chalk.green('======================================', '\n'))
    console.log('lndBootstrapConfig', lndBootstrapConfig)
    console.dir('paymentChannelResult', paymentChannelResult)
  } catch (error) {
    console.log(chalk.red('Failed to bootstrap LND Configurations. Please try again. ' + error.message))
  }
}

main().then(() => {
  process.exit(0)
})
