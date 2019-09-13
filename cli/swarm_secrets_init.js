/* Copyright (C) 2019 Tierion
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

const inquirer = require('inquirer')
const commandLineArgs = require('command-line-args')
const createSwarmAndSecrets = require('./scripts/0_swarm_secrets')
const cliHelloLogger = require('./utils/cliHelloLogger')
const stakingQuestions = require('./utils/swarmInitQuestions')
const exec = require('executive')
const chalk = require('chalk')
const { isEmpty, has, uniq } = require('lodash')
const { pipeP, curry, identity } = require('ramda')
const lightning = require('lnrpc-node-client')
const lndBootstrapQuestions = require('./utils/lndBootstrapQuestions')
const tap = require('./utils/tap')
const utils = require('../lib/utils')
const { updateOrCreateEnv, readEnv } = require('./utils/updateEnv')
const createPeerCxns = require('./scripts/1a_lnd_peer_cxns')
const { getWalletInfo } = require('./payment_channel_utils')
const homedir = require('os').homedir()

const argsDefinitions = [
  { name: 'NETWORK' },
  { name: 'NODE_PUBLIC_IP_ADDRESS' },
  { name: 'HOT_WALLET_PASS' },
  { name: 'HOT_WALLET_SEED' },
  { name: 'HOT_WALLET_ADDRESS' }
]
const args = commandLineArgs(argsDefinitions)
console.log(args)

const hotWalletPassword = process.env.HOT_WALLET_PASSWORD
const hotWalletSeed = process.env.HOT_WALLET_SEED

const envValues = readEnv()

const args1 = process.argv
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
  if (Object.keys(args).length > 1) {
    await createSwarmAndSecrets(args)
  } else {
    let writtenEnvValues = await pipeP(
      () => inquirer.prompt([stakingQuestions['NETWORK'], stakingQuestions['NODE_PUBLIC_IP_ADDRESS']]),
      createSwarmAndSecrets
    )()

    console.log('writtenEnvValues', JSON.stringify(writtenEnvValues))

    let isSyncedToChain = false
    while (!isSyncedToChain) {
      await utils.sleepAsync(15000)
      try {
        let res = await getWalletInfo(writtenEnvValues)
        isSyncedToChain = res.is_synced_to_chain

        console.log('LND Chain Syncing Done: ', isSyncedToChain)
      } catch (error) {
        console.log('Failed to make getWalletInfo() call', error)
      }
    }

    // ################################################################
    // LND Boostrapping Config
    // ################################################################
    const { connectAsync, getAllCoreIPs } = require('../lib/cores')
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
              .filter(currVal => !has(args1, currVal))
              .map(q => lndBootstrapQuestions[q])
          ),
        joinArgs,
        // Map captured config params applying specific validation/concatenation logic
        currVal => {
          if (isEmpty(envValues.CONNECTED_CORE_PAYMENT_CHANNELS_IPS))
            return Object.assign({}, currVal, writtenEnvValues)
          else {
            currVal.CONNECTED_CORE_PAYMENT_CHANNELS_IPS = uniq(
              envValues.CONNECTED_CORE_PAYMENT_CHANNELS_IPS.split(',').concat(
                currVal.CONNECTED_CORE_PAYMENT_CHANNELS_IPS.split(',')
              )
            ).join(',')
          }
          console.log('====================================')
          console.log(Object.assign({}, currVal, writtenEnvValues))
          console.log(JSON.stringify(writtenEnvValues))
          console.log('====================================')
          return Object.assign({}, currVal, writtenEnvValues)
        },
        tap(
          val => console.log(`Merging existing .env vals and newly capture env input: ${JSON.stringify(val)}`),
          identity
        ),
        curry(updateOrCreateEnv)(['CONNECTED_CORE_PAYMENT_CHANNELS_IPS', 'SATOSHIS_PER_CORE_PAYMENT_CHANNEL'])
      )()

      console.log('====================================')
      console.log('lndBootstrapConfig', lndBootstrapConfig)
      console.log('====================================')

      if (envValues.LND_PEER_CONNECTIONS_OPENED !== true) {
        let peerCxnResult = await pipeP(
          createPeerCxns,
          () => ({ LND_PEER_CONNECTIONS_OPENED: true }),
          curry(updateOrCreateEnv)([])
        )(lndBootstrapConfig, getAllCoreIPs())

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
  }
}

main().then(() => {
  process.exit(0)
})
