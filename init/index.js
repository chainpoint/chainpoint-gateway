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
const validator = require('validator')
const chalk = require('chalk')
const exec = require('executive')
const generator = require('generate-password')
const lightning = require('../lib/lightning')
const home = require('os').homedir()
const fs = require('fs')
const path = require('path')
const utils = require('../lib/utils.js')
const _ = require('lodash')
const rp = require('request-promise-native')
const retry = require('async-retry')

const QUIET_OUTPUT = true

const LND_SOCKET = '127.0.0.1:10009'
const MIN_CHANNEL_SATOSHI = 100000
const CHANNEL_OPEN_OVERHEAD_SAFE = 20000

const CORE_SEED_IPS_MAINNET = []
const CORE_SEED_IPS_TESTNET = ['35.222.97.4', '34.67.148.93']

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
    name: 'LND_PUBLIC_IP',
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

async function startLndNodeAsync(initAnswers) {
  try {
    let uid = (await exec.quiet('id -u $USER')).stdout.trim()
    let gid = (await exec.quiet('id -g $USER')).stdout.trim()
    console.log(chalk.yellow(`Starting Lightning node...`))
    await exec(
      [
        `docker-compose pull lnd && 
      mkdir -p ${home}/.chainpoint/node/.lnd && 
      export USERID=${uid} && 
      export GROUPID=${gid} && 
      docker-compose run -e NETWORK=${initAnswers.NETWORK} -d --service-ports lnd`
      ],
      { quiet: QUIET_OUTPUT }
    )
  } catch (error) {
    throw new Error(`Could not start Lightning node : ${error.message}`)
  }

  await utils.sleepAsync(10000)
}

async function initializeLndNodeAsync(initAnswers) {
  await startLndNodeAsync(initAnswers)

  let walletSecret = generator.generate({ length: 20, numbers: false })
  try {
    console.log(chalk.yellow(`Initializing Lightning wallet...`))
    let lnd = new lightning(LND_SOCKET, initAnswers.NETWORK, true, true)
    let seed = await lnd.callMethodRawAsync('unlocker', 'genSeedAsync', {}, true)
    await lnd.callMethodRawAsync('unlocker', 'initWalletAsync', {
      wallet_password: walletSecret,
      cipher_seed_mnemonic: seed.cipher_seed_mnemonic
    })

    await utils.sleepAsync(10000)

    console.log(chalk.yellow(`Create new address for wallet...`))
    lnd = new lightning(LND_SOCKET, initAnswers.NETWORK, false, true)
    let newAddress = await lnd.callMethodAsync('lightning', 'newAddressAsync', { type: 0 }, walletSecret)
    return { cipherSeedMnemonic: seed.cipher_seed_mnemonic, newAddress: newAddress.address, walletSecret: walletSecret }
  } catch (error) {
    throw new Error(`Could not initialize Lightning wallet : ${error.message}`)
  }
}

async function createDockerSecretsAsync(initAnswers, walletInfo) {
  try {
    console.log(chalk.yellow('Creating Docker secrets...'))
    await exec.quiet([
      `docker swarm init --advertise-addr=${initAnswers.NODE_PUBLIC_IP_ADDRESS} || echo "Swarm already initialized"`,
      `printf ${walletInfo.walletSecret} | docker secret create HOT_WALLET_PASS -`,
      `printf ${walletInfo.cipherSeedMnemonic.join(' ')} | docker secret create HOT_WALLET_SEED -`,
      `printf ${walletInfo.newAddress} | docker secret create HOT_WALLET_ADDRESS -`
    ])
  } catch (error) {
    throw new Error(`Could not create Docker secrets : ${error.message}`)
  }
}

function displayInitResults(walletInfo) {
  console.log(chalk.green(`\n****************************************************`))
  console.log(chalk.green(`Lightning initialization has completed successfully.`))
  console.log(chalk.green(`****************************************************\n`))
  console.log(chalk.yellow(`Lightning Wallet Password: `) + walletInfo.walletSecret)
  console.log(chalk.yellow(`Lightning Wallet Seed: `) + walletInfo.cipherSeedMnemonic.join(' '))
  console.log(chalk.yellow(`Lightning Wallet Address:`) + walletInfo.newAddress)
  console.log(chalk.magenta(`\n******************************************************`))
  console.log(chalk.magenta(`You should back up this information in a secure place.`))
  console.log(chalk.magenta(`******************************************************\n\n`))
}

async function setENVValuesAsync(newENVData) {
  // check for existence of .env file
  let envFileExists = fs.existsSync(path.resolve(__dirname, '../', '.env'))
  // load .env file if it exists, otherwise load the .env.sample file
  let envContents = fs.readFileSync(path.resolve(__dirname, '../', `.env${!envFileExists ? '.sample' : ''}`)).toString()

  let updatedEnvContents = Object.keys(newENVData).reduce((contents, key) => {
    let regexMatch = new RegExp(`^${key}=.*`, 'gim')
    if (!contents.match(regexMatch)) return contents + `\n${key}=${newENVData[key]}`
    return contents.replace(regexMatch, `${key}=${newENVData[key]}`)
  }, envContents)

  fs.writeFileSync(path.resolve(__dirname, '../', '.env'), updatedEnvContents)
}

async function getCorePeerListAsync(seedIPs) {
  seedIPs = _.shuffle(seedIPs)

  let peersReceived = false
  while (!peersReceived && seedIPs.length > 0) {
    let targetIP = seedIPs.pop()
    let options = {
      uri: `http://${targetIP}/peers`,
      method: 'GET',
      json: true,
      gzip: true,
      resolveWithFullResponse: true
    }
    try {
      let response = await retry(async () => await rp(options), { retries: 3 })
      return response.body.concat([targetIP])
    } catch (error) {
      console.log(`Core IP ${targetIP} not repsonding to peers requests`)
    }
  }
  throw new Error('Unable to retrieve Core peer list')
}

async function askCoreConnectQuestionsAsync(progress) {
  let peerList = _.shuffle(
    await getCorePeerListAsync(progress.network === 'maininet' ? CORE_SEED_IPS_MAINNET : CORE_SEED_IPS_TESTNET)
  )
  let peerCount = peerList.length

  const coreConnectQuestion = [
    {
      type: 'number',
      name: 'CORE_COUNT',
      message: `How many Cores would you like to connect to? (max ${peerCount})`,
      validate: input => input > 0 && input <= peerCount
    },
    {
      type: 'confirm',
      name: 'MANUAL_IP',
      message: 'Would you like to specify any Core IPs manually?',
      default: false
    }
  ]

  let coreConnectAnswers = await inquirer.prompt(coreConnectQuestion)

  let coreConnectIPs = []

  if (coreConnectAnswers.MANUAL_IP) {
    let manualCount = await inquirer.prompt({
      type: 'number',
      name: 'TOTAL',
      message: `How many Core IPs would you like to specify manually? (max ${coreConnectAnswers.CORE_COUNT})`,
      validate: input => input > 0 && input <= coreConnectAnswers.CORE_COUNT
    })
    for (let x = 0; x < manualCount.TOTAL; x++) {
      let manualInput = await inquirer.prompt({
        type: 'input',
        name: 'IP',
        message: `Enter Core IP manual entry #${x + 1}:`,
        validate: input => peerList.includes(input) && !coreConnectIPs.includes(input)
      })
      coreConnectIPs.push(manualInput.IP)
    }
  }

  let randomCoreIPCount = coreConnectAnswers.CORE_COUNT - coreConnectIPs.length
  let unusedPeers = peerList.filter(ip => !coreConnectIPs.includes(ip))
  for (let x = 0; x < randomCoreIPCount; x++) coreConnectIPs.push(unusedPeers.pop())

  // Update ENV file with core IP list
  await setENVValuesAsync({ CHAINPOINT_CORE_CONNECT_IP_LIST: coreConnectIPs.join(',') })

  let coreLNDUris = []
  for (let coreIP of coreConnectIPs) {
    let options = {
      uri: `http://${coreIP}/status`,
      method: 'GET',
      json: true,
      gzip: true,
      resolveWithFullResponse: true
    }
    try {
      let response = await retry(async () => await rp(options), { retries: 3 })
      coreLNDUris.push(response.body.uris[0])
    } catch (error) {
      throw new Error(`Unable to retrive status of Core at ${coreIP}`)
    }
  }

  progress.coreLNDUris = coreLNDUris
  writeInitProgress(progress)

  return coreLNDUris
}

async function askFundAmountAsync(progress) {
  const coreConnectCount = progress.coreLNDUris.length
  console.log(chalk.yellow(`\nYou have chosen to connect to ${coreConnectCount} Core(s).`))
  console.log(
    chalk.yellow(
      'You will now need to fund you wallet with a minimum amount of BTC to cover costs of the initial channel creation and future Core submissions.\n'
    )
  )

  const minAmount = MIN_CHANNEL_SATOSHI + CHANNEL_OPEN_OVERHEAD_SAFE

  let finalFundAmount = null
  let finalChannelAmount = null
  while (finalFundAmount === null) {
    const fundQuestion1 = [
      {
        type: 'number',
        name: 'AMOUNT',
        message: `How many Satoshi to commit to each channel/Core? (min ${minAmount})`,
        validate: input => input >= minAmount
      }
    ]
    let fundAnswer1 = await inquirer.prompt(fundQuestion1)

    const totalFundsNeeded = fundAnswer1.AMOUNT * coreConnectCount
    const fundQuestion2 = [
      {
        type: 'confirm',
        name: 'AGREE',
        message: `${
          fundAnswer1.AMOUNT
        } per channel will require ${totalFundsNeeded} Satoshi total funding. Is this OK?`,
        default: true
      }
    ]
    let fundAnswer2 = await inquirer.prompt(fundQuestion2)
    if (fundAnswer2.AGREE) {
      finalChannelAmount = fundAnswer1.AMOUNT
      finalFundAmount = totalFundsNeeded
    }
  }

  console.log(
    chalk.magenta(
      `\n**************************************************************************************************************`
    )
  )
  console.log(
    chalk.magenta(
      `Please send ${finalFundAmount} Satoshi (${finalFundAmount / 10 ** 8} BTC) to your wallet with address ${
        progress.walletAddress
      }`
    )
  )
  console.log(
    chalk.magenta(
      `**************************************************************************************************************\n`
    )
  )

  progress.finalFundAmount = finalFundAmount
  progress.finalChannelAmount = finalChannelAmount
  writeInitProgress(progress)

  return progress
}

async function waitForSyncAndFundingAsync(progress) {
  console.log(
    chalk.yellow(
      `This initialization process will now wait until your Lightning node is fully synced and your wallet is funded with at least ${
        progress.finalFundAmount
      } Satoshi.\n`
    )
  )

  let isSynced = false
  let isFunded = false
  let lnd = new lightning(LND_SOCKET, progress.network, false, true)
  while (!isSynced) {
    try {
      let info = await lnd.callMethodAsync('lightning', 'getInfoAsync', null, progress.walletSecret)
      if (info.synced_to_chain) {
        console.log(chalk.green('\n*****************************************'))
        console.log(chalk.green('Your lightning node is fully synced.'))
        console.log(chalk.green('*****************************************'))
        isSynced = true
      } else {
        console.log(
          chalk.magenta(
            `${new Date().toISOString()}> Syncing in progress... currently at block height ${info.block_height}`
          )
        )
      }
    } catch (error) {
      console.log(chalk.red(`An error occurred while checking node state : ${error.message}`))
    } finally {
      if (!isSynced) await utils.sleepAsync(30000)
    }
  }
  while (!isFunded) {
    try {
      let balance = await lnd.callMethodAsync('lightning', 'walletBalanceAsync', null, progress.walletSecret)
      if (balance.confirmed_balance >= progress.finalFundAmount) {
        console.log(chalk.green('\n***********************************************'))
        console.log(chalk.green('Your lightning wallet is adequately funded.'))
        console.log(chalk.green('***********************************************\n'))
        isFunded = true
      } else {
        console.log(
          chalk.magenta(
            `${new Date().toISOString()}> Awaiting funds for wallet... wallet has a current balance of ${
              balance.confirmed_balance
            }`
          )
        )
      }
    } catch (error) {
      console.log(chalk.red(`An error occurred while checking wallet balance : ${error.message}`))
    } finally {
      if (!isFunded) await utils.sleepAsync(30000)
    }
  }
}

async function createCoreLNDPeerConnectionsAsync(progress) {
  let lnd = new lightning(LND_SOCKET, progress.network, false, true)
  let peerPubKeys = []
  try {
    let peerList = await lnd.callMethodAsync('lightning', 'listPeersAsync', null, progress.walletSecret)
    for (let peer of peerList.peers) {
      peerPubKeys.push(peer.pub_key)
    }
  } catch (error) {
    throw new Error('Could not retrieve LND peer list')
  }

  for (let lndUri of progress.coreLNDUris) {
    let [pubkey, host] = lndUri.split('@')
    if (peerPubKeys.includes(pubkey)) continue // already peered to this node, skip
    try {
      await lnd.callMethodAsync(
        'lightning',
        'connectPeerAsync',
        { addr: { pubkey, host }, perm: true },
        progress.walletSecret
      )
      console.log(chalk.yellow(`Peer connection established with ${lndUri}`))
    } catch (error) {
      throw new Error(`Unable to establish a peer connection with ${lndUri} : ${error.message}`)
    }
  }
}

async function createCoreLNDChannelsAsync(progress) {
  let lnd = new lightning(LND_SOCKET, progress.network, false, true)
  let channelPubKeys = []
  try {
    let channelList = await lnd.callMethodAsync('lightning', 'listChannelsAsync', {}, progress.walletSecret)
    for (let channel of channelList.channels) {
      channelPubKeys.push(channel.remote_pubkey)
    }
  } catch (error) {
    throw new Error('Could not retrieve LND channel list', error.message)
  }

  for (let lndUri of progress.coreLNDUris) {
    let pubkey = lndUri.split('@')[0]
    if (channelPubKeys.includes(pubkey)) continue // already have a channel with this node, skip
    try {
      let channelTxInfo = await lnd.callMethodAsync(
        'lightning',
        'openChannelSyncAsync',
        {
          node_pubkey_string: pubkey,
          local_funding_amount: progress.finalChannelAmount,
          push_sat: 0
        },
        progress.walletSecret
      )
      console.log(chalk.yellow(`Channel created with ${lndUri} in transaction ${channelTxInfo.funding_txid_str}`))
    } catch (error) {
      throw new Error(`Unable to create a channel with ${lndUri} : ${error.message}`)
    }
  }
}

function displayFinalConnectionSummary() {
  console.log(chalk.green('\n*********************************************************************************'))
  console.log(chalk.green('\nChainpoint Node and supporting Lighning node have been successfully initialized.'))
  console.log(chalk.green('*********************************************************************************\n'))
}

function readInitProgress() {
  // check for existence of .init file
  let initFileExists = fs.existsSync(path.resolve(__dirname, './init.json'))
  // load .init file if it exists
  if (initFileExists) return JSON.parse(fs.readFileSync(path.resolve(__dirname, './init.json')).toString())
  return {}
}

function writeInitProgress(progress) {
  fs.writeFileSync(path.resolve(__dirname, './init.json'), JSON.stringify(progress, null, 2))
}

function setInitProgressCompleteAsync() {
  fs.writeFileSync(path.resolve(__dirname, './init.json'), JSON.stringify({ complete: true }, null, 2))
}

async function start() {
  try {
    // Check if init has already recorded some progress
    // This allows recovery from last known step in process
    // Exit of initialization has already completed successfully
    let progress = await readInitProgress()
    if (progress.complete) {
      console.log(chalk.green('Initialization has already been completed successfully.'))
      return
    }
    // Display the title screen
    displayTitleScreen()
    if (!progress.walletAddress) {
      // Ask initialization questions
      let initAnswers = await inquirer.prompt(initQuestionConfig)
      // Initialize the LND wallet and create a new address
      let walletInfo = await initializeLndNodeAsync(initAnswers)
      // Store relevant values as Docker secrets
      await createDockerSecretsAsync(initAnswers, walletInfo)
      // Update the .env file with generated data
      await setENVValuesAsync(initAnswers)
      // Display the generated wallet information to the user
      displayInitResults(walletInfo)
      progress.network = initAnswers.NETWORK
      progress.walletAddress = walletInfo.newAddress
      progress.walletSecret = walletInfo.walletSecret
      writeInitProgress(progress)
    } else {
      await startLndNodeAsync({ NETWORK: progress.network })
    }
    if (!progress.coreLNDUris) {
      // Determine which Core(s) to connect to
      let coreLNDUris = await askCoreConnectQuestionsAsync(progress)
      progress.coreLNDUris = coreLNDUris
    }
    // Ask funding questions
    if (!progress.finalChannelAmount > 0) {
      progress = await askFundAmountAsync(progress)
    }
    // Wait for sync and wallet funding
    await waitForSyncAndFundingAsync(progress)
    // Create peer connections to desired Cores
    await createCoreLNDPeerConnectionsAsync(progress)
    // Create channles to desired Cores
    await createCoreLNDChannelsAsync(progress)
    await displayFinalConnectionSummary()
    // Initialization complete, mark progress file as such
    setInitProgressCompleteAsync()
  } catch (error) {
    console.error(chalk.red(`An unexpected error has occurred : ${error.message}`))
  } finally {
    try {
      console.log(chalk.yellow(`Shutting down Lightning node...`))
      await exec([`docker-compose down`], { quiet: QUIET_OUTPUT })
      console.error(chalk.yellow(`Shutdown complete`))
    } catch (error) {
      console.error(chalk.red(`Unable to shut down Lightning node : ${error.message}`))
    }
  }
}

start()
