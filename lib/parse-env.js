/**
 * Copyright 2017 Tierion
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
const validUrl = require('valid-url')

const validateETHAddress = envalid.makeValidator(x => {
  if (!/^0x[0-9a-fA-F]{40}$/i.test(x)) throw new Error('The Ethereum (TNT) address is invalid')
  return x.toLowerCase()
})

const validateNodeUIPassword = envalid.makeValidator(x => {
  if (x === '') return x
  else if (!/^[a-zA-Z0-9]+$/.test(x)) throw new Error('The CHAINPOINT_NODE_UI_PASSWORD is invalid')
  else return x
})

// If URI supplied, ensure its valid, or continue with empty string
const validateCoreURI = envalid.makeValidator(x => {
  if (x && !validUrl.isWebUri(x)) throw new Error('The Core URI is invalid')
  return x
})

let envDefinitions = {
  // Node Ethereum Address w/ TNT balance
  NODE_TNT_ADDRESS: validateETHAddress({ desc: 'The Ethereum (TNT) address for this Node, expects 0x address', example: '0x0000000000000000000000000000000000000000' }),

  CHAINPOINT_NODE_PUBLIC_URI: envalid.url({ default: 'http://0.0.0.0', desc: 'The scheme and publicly accessible IP address for this Node. Use private range IP to skip advertising publicly.', example: 'http://0.0.0.0' }),

  CHAINPOINT_NODE_UI_PASSWORD: validateNodeUIPassword({ desc: 'The CHAINPOINT_NODE_UI_PASSWORD is used to control access to the Node UI Dashboard.' }),

  // Chainpoint Core
  CHAINPOINT_CORE_API_BASE_URI: validateCoreURI({ default: 'http://0.0.0.0', desc: 'Base URI for the Chainpoint Core' }),

  // PostgreSQL
  POSTGRES_CONNECT_PROTOCOL: envalid.str({ default: 'postgres:', desc: 'PostgreSQL server connection protocol' }),
  POSTGRES_CONNECT_USER: envalid.str({ default: 'chainpoint', desc: 'PostgreSQL server connection user name' }),
  POSTGRES_CONNECT_PW: envalid.str({ default: 'chainpoint', desc: 'PostgreSQL server connection password' }),
  POSTGRES_CONNECT_HOST: envalid.str({ default: 'postgres', desc: 'PostgreSQL server connection host' }),
  POSTGRES_CONNECT_PORT: envalid.num({ default: 5432, desc: 'PostgreSQL server connection port' }),
  POSTGRES_CONNECT_DB: envalid.str({ default: 'chainpoint', desc: 'PostgreSQL server connection database name' }),
  CALENDAR_TABLE_NAME: envalid.str({ default: 'calendar', desc: 'PostgreSQL table name for Calendar block data' }),
  PUBKEY_TABLE_NAME: envalid.str({ default: 'pubkey', desc: 'PostgreSQL table name for public key data' }),
  HMACKEY_TABLE_NAME: envalid.str({ default: 'hmackeys', desc: 'PostgreSQL table name for the Node\'s HMAC keys' }),

  // Redis
  REDIS_CONNECT_URI: envalid.url({ default: 'redis://redis:6379', desc: 'The Redis server connection URI' }),
  HASH_DATA_KEY: envalid.str({ default: 'hash_data', desc: 'Key for storing hash data as it is received' }),
  CORE_SUBMISSION_KEY_PREFIX: envalid.str({ default: 'hash_id_core', desc: 'Prefix of redis key containing Node aggregation data for item submitted to Core' }),
  HASH_NODE_LOOKUP_KEY_PREFIX: envalid.str({ default: 'hash_id_node', desc: 'Prefix of redis key containing hash_id_core and core id lookup by hash_id_node' }),

  // Proof Retention (Default 1440 minutes, 24 hours)
  PROOF_EXPIRE_MINUTES: envalid.num({ default: 1440, desc: 'The cache lifespan of stored proofs, in minutes' }),

  // API Limits
  POST_HASHES_MAX: envalid.num({ default: 1000, desc: 'The maximum number of hashes submitted in one request' }),
  POST_VERIFY_PROOFS_MAX: envalid.num({ default: 1000, desc: 'The maximum number of proofs verified in one request' }),
  GET_PROOFS_MAX_REST: envalid.num({ default: 250, desc: 'The maximum number of proofs retrieved in one request' })
}

module.exports = envalid.cleanEnv(process.env, envDefinitions, {
  strict: true
})
