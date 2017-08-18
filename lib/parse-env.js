const envalid = require('envalid')
const validUrl = require('valid-url')

// ensure it is a valid address
const validateTNTAddress = envalid.makeValidator(x => {
  if (!/^0x[0-9a-f]{40}$/i.test(x)) throw new Error('Invalid TNT address')
  return x.toLowerCase()
})

// if a value is supplied, ensure it is a valid uri, otherwise continue with empty string
const validateCoreUri = envalid.makeValidator(x => {
  if (x && !validUrl.isWebUri(x)) throw new Error('Value must be between 1 and 16, inclusive')
  return x
})

let envDefinitions = {

  // ***********************************************************************
  // * Global variables with default values
  // ***********************************************************************

  // Node Addresses
  CHAINPOINT_NODE_PUBLIC_SCHEME: envalid.str({ desc: 'The URI scheme of this Node when publicly accessible' }),
  CHAINPOINT_NODE_PUBLIC_ADDR: envalid.str({ desc: 'The URI address of this Node when publicly accessible' }),
  CHAINPOINT_NODE_PORT: envalid.str({ desc: 'The port of this Node' }),
  NODE_TNT_ADDRESS: validateTNTAddress({ desc: 'The TNT address for use by this Node' }),

  // Chainpoint service location
  CHAINPOINT_CORE_API_BASE_URI: validateCoreUri({ default: '', desc: 'Base URI for the Chainpoint Core' }),

  // Postgres related variables
  POSTGRES_CONNECT_PROTOCOL: envalid.str({ default: 'postgres:', desc: 'Postgres server connection protocol' }),
  POSTGRES_CONNECT_USER: envalid.str({ default: 'chainpoint', desc: 'Postgres server connection user name' }),
  POSTGRES_CONNECT_PW: envalid.str({ default: 'chainpoint', desc: 'Postgres server connection password' }),
  POSTGRES_CONNECT_HOST: envalid.str({ default: 'postgres', desc: 'Postgres server connection host' }),
  POSTGRES_CONNECT_PORT: envalid.num({ default: 5433, desc: 'Postgres server connection port' }),
  POSTGRES_CONNECT_DB: envalid.str({ default: 'chainpoint', desc: 'Postgres server connection database name' }),
  CALENDAR_TABLE_NAME: envalid.str({ default: 'calendar', desc: 'Postgres table name for Calendar block data' }),
  PUBKEY_TABLE_NAME: envalid.str({ default: 'pubkey', desc: 'Postgres table name for public key data' }),

  // Redis related variables
  REDIS_CONNECT_URI: envalid.url({ default: 'redis://redis:6381', desc: 'The Redis server connection URI' }),

  // Proof retention setting
  PROOF_EXPIRE_MINUTES: envalid.num({ default: 1440, desc: 'The lifespan of stored proofs, in minutes' }),

  // API request limits
  POST_HASHES_MAX: envalid.num({ default: 1000, desc: 'The maximum number of hashes allowed to be submitted in one request' }),
  POST_VERIFY_PROOFS_MAX: envalid.num({ default: 1000, desc: 'The maximum number of proofs allowed to be verified in one request' }),
  GET_CALENDAR_BLOCKS_MAX: envalid.num({ default: 1000, desc: 'The maximum number of calendar blocks allowed to be retrieved in one request' }),
  GET_PROOFS_MAX_REST: envalid.num({ default: 250, desc: 'The maximum number of proofs that can be requested in one GET /proofs request' })

}

module.exports = envalid.cleanEnv(process.env, envDefinitions, {
  strict: true
})
