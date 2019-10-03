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
const chalk = require('chalk')
const validator = require('validator')
const exec = require('executive')
const generator = require('generate-password')
const lightning = require('../lib/lightning')
const home = require('os').homedir()
const fs = require('fs')
const path = require('path')
const envfile = require('envfile')
const utils = require('../lib/utils.js')

const LND_SOCKET = '127.0.0.1:10009'

const NEW_WALLET_PASS = generator.generate({ length: 20, numbers: false })

const initQuestionConfig = [
  {
    type: 'list',
    name: 'NETWORK',
    message: 'Will this Core use Bitcoin mainnet or testnet?',
    choices: [
      {
        name: 'Mainnet',
        value: 'mainnet'
      },
      {
        name: 'Testnet',
        value: 'testnet'
      }
    ],
    default: 'mainnet'
  },
  {
    type: 'input',
    name: 'NODE_PUBLIC_IP_ADDRESS',
    message: "Enter your Node's Public IP Address:",
    validate: input => {
      if (input) {
        return validator.isIP(input, 4)
      } else {
        return true
      }
    }
  }
]

function displayTitleScreen() {
  const txt = `
  ██████╗██╗  ██╗ █████╗ ██╗███╗   ██╗██████╗  ██████╗ ██╗███╗   ██╗████████╗    ███╗   ██╗ ██████╗ ██████╗ ███████╗
  ██╔════╝██║  ██║██╔══██╗██║████╗  ██║██╔══██╗██╔═══██╗██║████╗  ██║╚══██╔══╝    ████╗  ██║██╔═══██╗██╔══██╗██╔════╝
  ██║     ███████║███████║██║██╔██╗ ██║██████╔╝██║   ██║██║██╔██╗ ██║   ██║       ██╔██╗ ██║██║   ██║██║  ██║█████╗
  ██║     ██╔══██║██╔══██║██║██║╚██╗██║██╔═══╝ ██║   ██║██║██║╚██╗██║   ██║       ██║╚██╗██║██║   ██║██║  ██║██╔══╝
  ╚██████╗██║  ██║██║  ██║██║██║ ╚████║██║     ╚██████╔╝██║██║ ╚████║   ██║       ██║ ╚████║╚██████╔╝██████╔╝███████╗
   ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝      ╚═════╝ ╚═╝╚═╝  ╚═══╝   ╚═╝       ╚═╝  ╚═══╝ ╚═════╝ ╚═════╝ ╚══════╝
`

  console.log('\n')
  console.log(chalk.dim.magenta(txt))
  console.log('\n')
}

async function initializeLndNodeAsync(initAnswers) {
  try {
    let uid = (await exec.quiet('id -u $USER')).stdout.trim()
    let gid = (await exec.quiet('id -g $USER')).stdout.trim()
    console.log(`Starting LND node...`)
    await exec([
      `mkdir -p ${home}/.chainpoint/node/.lnd && 
      export USERID=${uid} && 
      export GROUPID=${gid} && 
      docker-compose run -e NETWORK=${initAnswers.NETWORK} -d --service-ports lnd`
    ])
  } catch (error) {
    throw new Error(`Could not start LND : ${error.message}`)
  }

  await utils.sleepAsync(5000)

  try {
    console.log(`Initializing LND wallet...`)
    let lnd = new lightning(LND_SOCKET, initAnswers.NETWORK, true, true)
    let seed = await lnd.callMethodRawAsync('unlocker', 'genSeedAsync', {}, true)
    await lnd.callMethodRawAsync('unlocker', 'initWalletAsync', {
      wallet_password: NEW_WALLET_PASS,
      cipher_seed_mnemonic: seed.cipher_seed_mnemonic
    })

    await utils.sleepAsync(5000)

    console.log(`Create new address for wallet...`)
    lnd = new lightning(LND_SOCKET, initAnswers.NETWORK, false, true)
    let newAddress = await lnd.callMethodAsync('lightning', 'newAddressAsync', { type: 0 })
    return { cipherSeedMnemonic: seed.cipher_seed_mnemonic, newAddress: newAddress.address }
  } catch (error) {
    throw new Error(`Could not initialize LND wallet : ${error.message}`)
  }
}

async function createDockerSecretsAsync(initAnswers, walletInfo) {
  try {
    console.log('Creating Docker secrets...')
    await exec.quiet([
      `docker swarm init --advertise-addr=${initAnswers.NODE_PUBLIC_IP_ADDRESS} || echo "Swarm already initialized"`,
      `printf ${NEW_WALLET_PASS} | docker secret create HOT_WALLET_PASS -`,
      `printf ${walletInfo.cipherSeedMnemonic.join(' ')} | docker secret create HOT_WALLET_SEED -`,
      `printf ${walletInfo.newAddress} | docker secret create HOT_WALLET_ADDRESS -`
    ])
  } catch (error) {
    throw new Error(`Could not create Docker secrets : ${error.message}`)
  }
}

function displayInitResults(walletInfo) {
  console.log(chalk.green(`\nLND initialization has completed successfully`))
  console.log(`\nLND Wallet Password:\n` + chalk.yellow(NEW_WALLET_PASS))
  console.log(`LND Wallet Seed:\n` + chalk.yellow(walletInfo.cipherSeedMnemonic.join(' ')))
  console.log(`LND Wallet Address:\n` + chalk.yellow(walletInfo.newAddress))
}

async function setENVValuesAsync(initAnswers, walletInfo) {
  updateOrCreateEnvAsync([], {
    NETWORK: initAnswers.NETWORK,
    NODE_PUBLIC_IP_ADDRESS: `http://${initAnswers.NODE_PUBLIC_IP_ADDRESS}`,
    NODE_RAW_IP: initAnswers.NODE_PUBLIC_IP_ADDRESS,
    HOT_WALLET_ADDRESS: walletInfo.newAddress
  })
}

async function updateOrCreateEnvAsync(blacklist, valuePairs) {
  const valuePairsClone = JSON.parse(JSON.stringify(valuePairs))
  // Prevent blacklisted keys from being persisted to .env
  blacklist.forEach(currVal => delete valuePairs[currVal])
  if (fs.existsSync(path.resolve(__dirname, '../', '.env'))) {
    let env = envfile.parseFileSync(path.resolve(__dirname, '../', '.env'))

    fs.writeFileSync(path.resolve(__dirname, '../', '.env'), envfile.stringifySync(Object.assign({}, env, valuePairs)))
  } else {
    // .env has yet to be created, create from .env.sample
    let env = envfile.parseFileSync(path.resolve(__dirname, '../', '.env.sample'))

    fs.writeFileSync(path.resolve(__dirname, '../', '.env'), envfile.stringifySync(Object.assign({}, env, valuePairs)))
  }
  return Promise.resolve(valuePairsClone)
}

async function start() {
  try {
    // Display the title screen
    displayTitleScreen()
    // Ask initialization questions
    let initAnswers = await inquirer.prompt(initQuestionConfig)
    let walletInfo = await initializeLndNodeAsync(initAnswers)
    await createDockerSecretsAsync(initAnswers, walletInfo)
    await setENVValuesAsync(initAnswers, walletInfo)
    displayInitResults(walletInfo)
  } catch (error) {
    console.error(chalk.red(`An unexpected error has occurred : ${error.message}`))
  }
}

start()
