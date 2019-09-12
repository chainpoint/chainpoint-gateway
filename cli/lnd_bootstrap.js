const exec = require('executive')
const chalk = require('chalk')
const { isEmpty, has, uniq } = require('lodash')
const { pipeP, curry, identity } = require('ramda')
const inquirer = require('inquirer')
const lightning = require('lnrpc-node-client')
const cliHelloLogger = require('./utils/cliHelloLogger')
const stakingQuestions = require('./utils/lndBootstrapQuestions')
const tap = require('./utils/tap')
const utils = require('../lib/utils')
const { updateOrCreateEnv, readEnv } = require('./utils/updateEnv')
const { connectAsync, getAllCoreIPs } = require('../lib/cores')
const createPeerCxns = require('./scripts/1a_lnd_peer_cxns')
const { getWalletInfo } = require('./payment_channel_utils')
const homedir = require('os').homedir()

const hotWalletPassword = process.env.HOT_WALLET_PASSWORD
const hotWalletSeed = process.env.HOT_WALLET_SEED

lightning.setTls('127.0.0.1:10009', `${homedir}/.lnd/tls.cert`)
let unlocker = lightning.unlocker()
lightning.promisifyGrpc(unlocker)

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
  let uid = (await exec.quiet('id -u $USER')).stdout.trim()
  let gid = (await exec.quiet('id -g $USER')).stdout.trim()

  // startup docker compose
  try {
    console.log('initializing LND...')
    await exec([`export USERID=${uid} && export GROUPID=${gid} && docker-compose run -d --service-ports lnd`])
    await utils.sleepAsync(5000)
    console.log('LND initialized')
  } catch (err) {
    console.log(chalk.red(`Could not bring up lnd for initialization: ${err}`))
    return
  }
  // Unlock LND wallet
  await unlocker.initWalletAsync({ wallet_password: hotWalletPassword, cipher_seed_mnemonic: hotWalletSeed.split(' ') })
  await utils.sleepAsync(5000)
  await unlocker.unlockWalletAsync({ wallet_password: hotWalletPassword, recovery_window: 25000 })

  let isSyncedToChain = false
  while (!isSyncedToChain) {
    await utils.sleepAsync(15000)
    try {
      let res = await getWalletInfo()
      isSyncedToChain = res.is_synced_to_chain

      console.log('LND Chain Syncing Done: ', isSyncedToChain)
    } catch (error) {
      console.log('Failed to make getWalletInfo() call', error)
    }
  }

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

    let paymentChannelResult = await pipeP(
      connectAsync,
      paymentCxnRes => ({ CONNECTED_CORE_PAYMENT_CHANNELS_IPS: paymentCxnRes.ips }),
      tap(val => console.log(`PaymentCxnResult: ${JSON.stringify(val)}`), identity),
      curry(updateOrCreateEnv)([])
    )(lndBootstrapConfig)

    console.log(chalk.green('\n======================================'))
    console.log(chalk.green('==   SUCCESSFULLY BOOTSRAPPED LND CONFIGURATIONS!  =='))
    console.log(chalk.green('======================================', '\n'))
    console.log('lndBootstrapConfig', lndBootstrapConfig)
    console.dir('paymentChannelResult', paymentChannelResult)
  } catch (error) {
    console.log(chalk.red('Failed to bootstrap LND Configurations. Please try again. ' + error.message))
  }

  try {
    console.log('shutting down LND...')
    await exec([`docker-compose down`])
    console.log('LND shut down')
  } catch (err) {
    console.log(chalk.red(`Could not bring down LND: ${err}`))
    return
  }
}

main().then(() => {
  process.exit(0)
})
