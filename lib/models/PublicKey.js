// load environment variables
const env = require('../parse-env.js')

const Sequelize = require('sequelize')

// Connection URI for Postgres
const POSTGRES_CONNECT_URI = `${env.POSTGRES_CONNECT_PROTOCOL}//${env.POSTGRES_CONNECT_USER}:${env.POSTGRES_CONNECT_PW}@${env.POSTGRES_CONNECT_HOST}:${env.POSTGRES_CONNECT_PORT}/${env.POSTGRES_CONNECT_DB}`

const sequelize = new Sequelize(POSTGRES_CONNECT_URI, { logging: null })

let PublicKey = sequelize.define(env.PUBKEY_TABLE_NAME,
  {
    pubKeyHash: {
      comment: 'The first 12 characters of the public key sha-256 hash.',
      primaryKey: true,
      type: Sequelize.STRING,
      validate: {
        is: ['^[a-fA-F0-9]{12}$', 'i']
      },
      field: 'pub_key_hash',
      allowNull: false,
      unique: true
    },
    pubKey: {
      comment: 'The base 64 encoded public key.',
      type: Sequelize.STRING,
      validate: {
        is: ['^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$', 'i']
      },
      field: 'pub_key',
      allowNull: false,
      unique: true
    }
  },
  {
    // No automatic timestamp fields, we add our own 'timestamp' so it is
    // known prior to save so it can be included in the block signature.
    timestamps: false,
    // Disable the modification of table names; By default, sequelize will automatically
    // transform all passed model names (first parameter of define) into plural.
    // if you don't want that, set the following
    freezeTableName: true
  }
)

module.exports = {
  sequelize: sequelize,
  PublicKey: PublicKey
}
