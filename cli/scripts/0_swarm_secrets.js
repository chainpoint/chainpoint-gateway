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

const exec = require('executive')
const chalk = require('chalk')
const generator = require('generate-password')
const utils = require('../../lib/utils')
const { updateOrCreateEnv } = require('../utils/updateEnv')
const lightning = require('../../lib/lightning')

let pass = generator.generate({
  length: 20,
  numbers: false
})

async function createSwarmAndSecrets(lndOpts) {
  const LND_SOCKET = '127.0.0.1:10009'

  try {
    try {
      let home = (await exec.quiet('/bin/bash -c "$(eval printf ~$USER)"')).stdout.trim()
      let uid = (await exec.quiet('id -u $USER')).stdout.trim()
      let gid = (await exec.quiet('id -g $USER')).stdout.trim()
      await exec([
        `mkdir -p ${home}/.lnd/chainpoint-node && export USERID=${uid} && export GROUPID=${gid} && docker-compose run -d --service-ports lnd`
      ])
      await utils.sleepAsync(5000)
    } catch (err) {
      console.log(chalk.red(`Could not bring up LND: ${err}`))
    }
    let lnd = new lightning(LND_SOCKET, lndOpts.NETWORK, true)
    let seed = await lnd.callMethodRawAsync('unlocker', 'genSeedAsync', {})
    console.log(seed)
    let init = lnd.callMethodRawAsync('unlocker', 'initWalletAsync', {
      wallet_password: pass,
      cipher_seed_mnemonic: seed.value.cipher_seed_mnemonic
    })
    console.log(init)

    await new Promise(resolve => {
      setTimeout(() => {
        resolve()
      }, 7000)
    })

    process.env.HOT_WALLET_PASS = pass
    lnd = new lightning(LND_SOCKET, lndOpts.NETWORK)
    let address = await lnd.callMethodAsync('lightning', 'newAddressAsync', { type: 0 })
    console.log(address)

    // Create Docker secrets
    try {
      await exec.quiet([
        `docker swarm init --advertise-addr=${lndOpts.NODE_PUBLIC_IP_ADDRESS} || echo "Swarm already initialized"`,
        `printf ${pass} | docker secret create HOT_WALLET_PASS -`,
        `printf ${seed.value.cipher_seed_mnemonic.join(' ')} | docker secret create HOT_WALLET_SEED -`,
        `printf ${address.value.address} | docker secret create HOT_WALLET_ADDRESS -`
      ])
      console.log(chalk.yellow(`\nLND Wallet Password: ${pass}`))
      console.log(chalk.yellow(`\nLND Wallet Seed: ${seed.value.cipher_seed_mnemonic.join(' ')}`))
      console.log(chalk.yellow(`\nLND Wallet Address: ${address.value.address}\n`))
    } catch (err) {
      console.log(chalk.red(`Could not exec docker secret creation: ${err}`))
    }

    return updateOrCreateEnv([], {
      NETWORK: lndOpts.NETWORK,
      NODE_PUBLIC_IP_ADDRESS: `http://${lndOpts.NODE_PUBLIC_IP_ADDRESS}`,
      NODE_RAW_IP: lndOpts.NODE_PUBLIC_IP_ADDRESS,
      HOT_WALLET_ADDRESS: address.value.address
    })
  } catch (error) {
    console.log(error)
  }
}

module.exports = createSwarmAndSecrets
