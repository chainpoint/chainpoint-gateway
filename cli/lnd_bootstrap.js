const chalk = require('chalk')
const { isEmpty, has } = require('lodash')
const { pipeP, curry, identity } = require('ramda')
const inquirer = require('inquirer')
const cliHelloLogger = require('./utils/cliHelloLogger')
const stakingQuestions = require('./utils/lndBootstrapQuestions')
const tap = require('./utils/tap')
const updateOrCreateEnv = require('./utils/updateEnv')
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
      curry(updateOrCreateEnv)(['CONNECTED_CORE_PAYMENT_CHANNELS_IPS', 'SATOSHIS_PER_CORE_PAYMENT_CHANNEL'])
    )()

    let paymentChannelResult = await pipeP(
      connectAsync,
      paymentCxnRes => ({ CONNECTED_CORE_PAYMENT_CHANNELS_IPS: paymentCxnRes.ips }),
      tap(val => console.log(`PaymentCxnResult: ${val}`), identity),
      updateOrCreateEnv
    )(lndBootstrapConfig)
    let peerCxnResult = await pipeP(createPeerCxns)(getAllCoreIPs())

    console.log(chalk.green('\n======================================'))
    console.log(chalk.green('==   SUCCESSFULLY BOOTSRAPPED LND CONFIGURATIONS!  =='))
    console.log(chalk.green('======================================', '\n'))
    console.log('lndBootstrapConfig', lndBootstrapConfig)
    console.dir('paymentChannelResult', paymentChannelResult)
    console.dir('peerCxnResult', peerCxnResult)
  } catch (error) {
    console.log(chalk.red('Failed to bootstrap LND Configurations. Please try again. ' + error.message))
  }
}

main().then(() => {
  process.exit(0)
})
