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

// TODO: Prune and potentially rename some of these  env variables

const envalid = require('envalid')
const validUrl = require('valid-url')

const validateETHAddress = envalid.makeValidator(x => {
  if (!/^0x[0-9a-fA-F]{40}$/i.test(x)) throw new Error('The Ethereum (TNT) address is invalid')
  return x.toLowerCase()
})

const validateNodeUIPassword = envalid.makeValidator(x => {
  if (x === '') {
    return x
  } else if (x === 'empty') {
    // Handle the special 'empty' password which is a default password from
    // docker-compose.yaml when CHAINPOINT_NODE_UI_PASSWORD is unset. This
    // prevents a WARNING in the log output.
    let x = ''
    return x
  } else if (!/^[a-zA-Z0-9]+$/.test(x)) {
    throw new Error('The CHAINPOINT_NODE_UI_PASSWORD is invalid')
  } else {
    return x
  }
})

// If URI supplied, ensure its valid, or continue with empty string
const validateCoreURI = envalid.makeValidator(x => {
  if (x && !validUrl.isWebUri(x)) throw new Error('The Core URI is invalid')
  return x
})

let envDefinitions = {
  // Node Ethereum Address w/ TNT balance
  NODE_TNT_ADDRESS: validateETHAddress({
    desc: 'The Ethereum (TNT) address for this Node, expects 0x address',
    example: '0x0000000000000000000000000000000000000000'
  }),

  // TODO: See about potentially cleaning up how we define these URI variables, why mix of URL and STR?

  CHAINPOINT_NODE_PUBLIC_URI: envalid.url({
    default: 'http://0.0.0.0',
    desc:
      'The scheme and publicly accessible IP address for this Node. Use private range IP to skip advertising publicly.',
    example: 'http://0.0.0.0'
  }),

  CHAINPOINT_NODE_PRIVATE_URI: envalid.str({
    default: '',
    desc:
      'A URI with a Private (RFC1918) IPv4 Address used to expose additional metadata when submitting a POST /hashes.'
  }),

  CHAINPOINT_NODE_REFLECTED_URI: envalid.str({
    default: '',
    desc:
      'An enumerated data type consisting of two enumerals (public|private). Used in conjunction with CHAINPOINT_NODE_PUBLIC_URI or CHAINPOINT_NODE_PRIVATE_URI to provide additional metadata when submitting a POST /hashes.'
  }),

  CHAINPOINT_NODE_UI_PASSWORD: validateNodeUIPassword({
    desc: 'The CHAINPOINT_NODE_UI_PASSWORD is used to control access to the Node UI Dashboard.'
  }),

  // Chainpoint Core
  CHAINPOINT_CORE_API_BASE_URI: validateCoreURI({
    default: 'http://0.0.0.0',
    desc: 'Base URI for the Chainpoint Core'
  }),

  // Proof Retention (Default 1440 minutes, 24 hours)
  PROOF_EXPIRE_MINUTES: envalid.num({ default: 1440, desc: 'The cache lifespan of stored proofs, in minutes' }),

  // API Limits
  POST_HASHES_MAX: envalid.num({
    default: 1000,
    desc: 'The maximum number of hashes submitted in one request'
  }),
  POST_VERIFY_PROOFS_MAX: envalid.num({ default: 1000, desc: 'The maximum number of proofs verified in one request' }),
  GET_PROOFS_MAX_REST: envalid.num({
    default: 250,
    desc: 'The maximum number of proofs retrieved in one request'
  })
}

module.exports = envalid.cleanEnv(process.env, envDefinitions, { strict: true })
