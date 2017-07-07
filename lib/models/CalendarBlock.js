// load environment variables
const env = require('../parse-env.js')

var Sequelize = require('sequelize')

// Connection URI for Postgres
const POSTGRES_CONNECT_URI = `${env.POSTGRES_CONNECT_PROTOCOL}//${env.POSTGRES_CONNECT_USER}:${env.POSTGRES_CONNECT_PW}@${env.POSTGRES_CONNECT_HOST}:${env.POSTGRES_CONNECT_PORT}/${env.POSTGRES_CONNECT_DB}`

const sequelize = new Sequelize(POSTGRES_CONNECT_URI, { logging: null })

var CalendarBlock = sequelize.define(env.CALENDAR_TABLE_NAME,
  {
    id: {
      comment: 'Sequential monotonically incrementing Integer ID representing block height.',
      primaryKey: true,
      type: Sequelize.INTEGER,
      validate: {
        isInt: true
      },
      allowNull: false,
      unique: true
    },
    time: {
      comment: 'Block creation time in seconds since unix epoch',
      type: Sequelize.INTEGER,
      validate: {
        isInt: true
      },
      allowNull: false
    },
    version: {
      comment: 'Block version number, for future use.',
      type: Sequelize.INTEGER,
      defaultValue: function () {
        return 1
      },
      validate: {
        isInt: true
      },
      allowNull: false
    },
    stackId: {
      comment: 'The Chainpoint stack identifier',
      type: Sequelize.STRING,
      field: 'stack_id',
      allowNull: false
    },
    type: {
      comment: 'Block type.',
      type: Sequelize.STRING,
      validate: {
        isIn: [['gen', 'cal', 'nist', 'btc-a', 'btc-c', 'eth-a', 'eth-c']]
      },
      allowNull: false
    },
    dataId: {
      comment: 'The identifier for the data to be anchored to this block, data identifier meaning is determined by block type.',
      type: Sequelize.STRING,
      validate: {
        is: ['^[a-fA-F0-9:]{0,255}$', 'i']
      },
      field: 'data_id',
      allowNull: false
    },
    dataVal: {
      comment: 'The data to be anchored to this block, data value meaning is determined by block type.',
      type: Sequelize.STRING,
      validate: {
        is: ['^[a-fA-F0-9:]{1,255}$', 'i']
      },
      field: 'data_val',
      allowNull: false
    },
    prevHash: {
      comment: 'Block hash of previous block',
      type: Sequelize.STRING,
      validate: {
        is: ['^[a-f0-9]{64}$', 'i']
      },
      field: 'prev_hash',
      allowNull: false,
      unique: true
    },
    hash: {
      comment: 'The block hash, a hex encoded SHA-256 over canonical values',
      type: Sequelize.STRING,
      validate: {
        is: ['^[a-f0-9]{64}$', 'i']
      },
      allowNull: false,
      unique: true
    },
    sig: {
      comment: 'Truncated SHA256 hash of Signing PubKey bytes, colon separated, plus Base64 encoded signature over block hash',
      type: Sequelize.STRING,
      validate: {
        is: ['^[a-zA-Z0-9:=+/]{1,255}$', 'i']
      },
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
  CalendarBlock: CalendarBlock
}
