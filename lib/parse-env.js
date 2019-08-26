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
const validator = require('validator')

function valBase64(value) {
  let isBase64 = validator.isBase64(value)
  if (!isBase64) throw new Error('The supplied value must be a valid Base 64 encoded string')
  return value
}

function valSocket(value) {
  const errorMessage = 'The supplied value must be a valid <host>:<port> string'
  let segments = value.split(':')
  if (segments.length !== 2) throw new Error(errorMessage)
  let host = segments[0]
  let port = segments[1]
  if (!validator.isFQDN(host) && !validator.isIP(host) && host !== 'localhost') throw new Error(errorMessage)
  if (!validator.isPort(port)) throw new Error(errorMessage)
  return value
}

function valCoreIPList(list) {
  // If IP list supplied, ensure it is valid, or continue with empty string
  if (list === '') return ''
  let IPs = list.split(',')
  for (let val of IPs) {
    if ((!ip.isV4Format(val) && !ip.isV6Format(val)) || val === '') throw new Error('The Core IP list is invalid')
  }
  // ensure each IP is unique
  let ipSet = new Set(IPs)
  if (ipSet.size !== IPs.length) throw new Error('The Core IPs cannot contain duplicates')
  return IPs
}

function valNetwork(name) {
  if (name === '' || name === 'mainnet') return 'mainnet'
  if (name === 'testnet') return 'testnet'
  throw new Error('The NETWORK value is invalid')
}

const validateBase64 = envalid.makeValidator(valBase64)
const validateSocket = envalid.makeValidator(valSocket)
const validateCoreIPList = envalid.makeValidator(valCoreIPList)
const validateNetwork = envalid.makeValidator(valNetwork)

let envDefinitions = {
  // Lightning Node connection
  LND_TLS_CERT: validateBase64({
    default: '',
    desc: 'A base 64 encoded TLS certificate for the client LND node'
  }),
  LND_MACAROON: validateBase64({
    default: '',
    desc: 'A base 64 encoded macaroon for access to the client LND node'
  }),
  LND_SOCKET: validateSocket({
    default: '',
    desc: 'The host:port value of the client LND node'
  }),

  // Chainpoint Core
  CHAINPOINT_CORE_CONNECT_IP_LIST: validateCoreIPList({
    default: '',
    desc: 'A comma separated list of specific Core IPs to connect to (and only to) instead of using Core discovery'
  }),

  CHAINPOINT_NODE_HTTP_PORT: envalid.port({
    default: 80,
    desc: `Port number to which the Node's HTTP API server will bound`
  }),

  AGGREGATION_INTERVAL_SECONDS: envalid.num({
    default: 60,
    desc: `The aggregation and Core submission frequency, in seconds`
  }),

  PROOF_EXPIRE_MINUTES: envalid.num({
    default: 1440,
    desc: `The length of time proofs as stored on the node for retrieval, in minutes`
  }),

  POST_HASHES_MAX: envalid.num({
    default: 1000,
    desc: `The maximum number of hashes accepted in a single submit request`
  }),

  POST_VERIFY_PROOFS_MAX: envalid.num({
    default: 1000,
    desc: `The maximum number of proofs accepted in a single verification request`
  }),

  GET_PROOFS_MAX: envalid.num({
    default: 250,
    desc: `The maximum number of proofs to be returned in a single request`
  }),

  NETWORK: validateNetwork({ default: 'mainnet', desc: `The network to use, 'mainnet' or 'testnet'` }),

  NODE_ENV: envalid.str({ default: 'production', desc: 'The type of environment in which this Node is running' })
}

module.exports = {
  env: envalid.cleanEnv(process.env, envDefinitions, { strict: false }),
  // additional functions for testing purposes
  valCoreIPList: valCoreIPList,
  valNetwork: valNetwork
}
