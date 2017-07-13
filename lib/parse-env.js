const envalid = require('envalid')
const CHAINPOINT_CORE_API_BASE_URI_DEFAULT = 'http://104.198.1.217' // Staging server

let envDefinitions = {

  // ***********************************************************************
  // * Global variables with default values
  // ***********************************************************************

  // Chainpoint service location
  CHAINPOINT_CORE_API_BASE_URI: envalid.url({ default: CHAINPOINT_CORE_API_BASE_URI_DEFAULT, desc: 'Base URI for the Chainpoint Core' }),

  // Postgres related variables
  POSTGRES_CONNECT_PROTOCOL: envalid.str({ default: 'postgres:', desc: 'Postgres server connection protocol' }),
  POSTGRES_CONNECT_USER: envalid.str({ default: 'chainpoint', desc: 'Postgres server connection user name' }),
  POSTGRES_CONNECT_PW: envalid.str({ default: 'chainpoint', desc: 'Postgres server connection password' }),
  POSTGRES_CONNECT_HOST: envalid.str({ default: 'postgres', desc: 'Postgres server connection host' }),
  POSTGRES_CONNECT_PORT: envalid.num({ default: 5432, desc: 'Postgres server connection port' }),
  POSTGRES_CONNECT_DB: envalid.str({ default: 'chainpoint', desc: 'Postgres server connection database name' }),
  CALENDAR_TABLE_NAME: envalid.str({ default: 'calendar', desc: 'Postgres table name for Calendar block data' }),

  // Redis related variables
  REDIS_CONNECT_URI: envalid.url({ default: 'redis://redis:6379', desc: 'The Redis server connection URI' }),

  // Proof retention setting
  PROOF_EXPIRE_MINUTES: envalid.num({ default: 1440, desc: 'The lifespan of stored proofs, in minutes' })

}

module.exports = envalid.cleanEnv(process.env, envDefinitions, {
  strict: true
})
