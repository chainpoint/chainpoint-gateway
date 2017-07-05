const envalid = require('envalid')
const CHAINPOINT_API_BASE_URI_DEFAULT = 'http://127.0.0.1'

let envDefinitions = {

  // ***********************************************************************
  // * Global variables with default values
  // ***********************************************************************

  // Chainpoint service location
  CHAINPOINT_API_BASE_URI: envalid.url({ default: CHAINPOINT_API_BASE_URI_DEFAULT, desc: 'Base URI for the Chainpoint services to consume' })

}

module.exports = envalid.cleanEnv(process.env, envDefinitions, {
  strict: true
})
