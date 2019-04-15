/**
 * Copyright 2019 Tierion
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const envalid = require('envalid')
const ip = require('ip')

function valETHAddress(addr) {
  if (!/^0x[0-9a-fA-F]{40}$/i.test(addr)) throw new Error('The Ethereum address is invalid')
  return addr.toLowerCase()
}

function valNodeUIPassword(pw) {
  if (!/^[a-zA-Z0-9]*$/.test(pw)) {
    throw new Error('The CHAINPOINT_NODE_UI_PASSWORD is invalid')
  } else {
    return pw
  }
}

function valCoreIPList(list) {
  // If URI supplied, ensure its valid, or continue with empty string
  if (list === '') return ''
  let IPs = list.split(',')
  for (let val of IPs) {
    if ((!ip.isV4Format(val) && !ip.isV6Format(val)) || val === '') throw new Error('The Core IP list is invalid')
  }
  return IPs
}

function valAutoAcquire(bool) {
  bool = bool.toString().toLowerCase()
  if (bool === 'false') return false
  if (bool === 'true') return true
  throw new Error('The AUTO_ACQUIRE_ENABLED value is invalid')
}

function valAutoAcquireAmount(amount) {
  amount = parseInt(amount)
  if (amount > 0 && amount <= 8760) return amount
  throw new Error('The AUTO_ACQUIRE_AMOUNT value is invalid')
}

const validateETHAddress = envalid.makeValidator(valETHAddress)
const validateNodeUIPassword = envalid.makeValidator(valNodeUIPassword)
const validateCoreIPList = envalid.makeValidator(valCoreIPList)
const validateAutoAcquire = envalid.makeValidator(valAutoAcquire)
const validateAutoAcquireAmount = envalid.makeValidator(valAutoAcquireAmount)

let envDefinitions = {
  // Node Ethereum Address with stake
  NODE_ETH_ADDRESS: validateETHAddress({
    desc: 'The Ethereum address for this Node, expects 0x address',
    example: '0x0000000000000000000000000000000000000000'
  }),

  AUTO_ACQUIRE_ENABLED: validateAutoAcquire({
    desc: 'Enable automatic acquisition of credit when balance reaches 0 (true|false)',
    example: 'true'
  }),

  AUTO_ACQUIRE_AMOUNT: validateAutoAcquireAmount({
    desc: 'The number of credits to purchase on each acquistition',
    example: '720'
  }),

  CHAINPOINT_NODE_PUBLIC_URI: envalid.str({
    default: '',
    desc:
      'The scheme and publicly accessible IP address for this Node. Use private range IP to skip advertising publicly.'
  }),

  CHAINPOINT_NODE_PRIVATE_URI: envalid.str({
    default: '',
    desc:
      'A URI with a Private (RFC1918) IPv4 Address used to expose additional metadata when submitting a POST /hashes.'
  }),

  CHAINPOINT_NODE_REFLECT_PUBLIC_OR_PRIVATE: envalid.str({
    default: '',
    desc:
      'An enumerated data type consisting of two enumerals (public|private). Used in conjunction with CHAINPOINT_NODE_PUBLIC_URI or CHAINPOINT_NODE_PRIVATE_URI to provide additional metadata when submitting a POST /hashes.'
  }),

  CHAINPOINT_NODE_UI_PASSWORD: validateNodeUIPassword({
    desc: 'The CHAINPOINT_NODE_UI_PASSWORD is used to control access to the Node UI Dashboard.'
  }),

  // Chainpoint Core
  CHAINPOINT_CORE_CONNECT_IP_LIST: validateCoreIPList({
    default: '',
    desc: 'A comma separated list of specific Core IPs to connect to (and only to) instead of using Core discovery'
  }),

  HTTP_PORT: envalid.port({
    default: 80,
    desc: 'Port number to which the API Server will bound to.'
  })
}

module.exports = {
  env: envalid.cleanEnv(
    Object.assign(process.env, {
      PROOF_EXPIRE_MINUTES: 1440,
      POST_HASHES_MAX: 1000,
      POST_VERIFY_PROOFS_MAX: 1000,
      GET_PROOFS_MAX: 250,
      GET_REPUTATION_MAX: 1000
    }),
    envDefinitions,
    {
      strict: false
    }
  ),
  // additional functions for testing purposes
  valETHAddress: valETHAddress,
  valNodeUIPassword: valNodeUIPassword,
  valCoreIPList: valCoreIPList,
  valAutoAcquire: valAutoAcquire,
  valAutoAcquireAmount: valAutoAcquireAmount
}
