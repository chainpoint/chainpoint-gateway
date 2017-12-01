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

// load environment variables
const env = require('../parse-env.js')

const Sequelize = require('sequelize')

// Connection URI for Postgres
const POSTGRES_CONNECT_URI = `${env.POSTGRES_CONNECT_PROTOCOL}//${env.POSTGRES_CONNECT_USER}:${env.POSTGRES_CONNECT_PW}@${env.POSTGRES_CONNECT_HOST}:${env.POSTGRES_CONNECT_PORT}/${env.POSTGRES_CONNECT_DB}`

const sequelize = new Sequelize(POSTGRES_CONNECT_URI, { logging: null, operatorsAliases: false })

let HMACKey = sequelize.define(env.HMACKEY_TABLE_NAME,
  {
    tntAddr: {
      comment: 'The Ethereum address for the Node.',
      type: Sequelize.STRING,
      validate: {
        is: ['^0x[0-9a-f]{40}$', 'i']
      },
      field: 'tnt_addr',
      allowNull: false,
      unique: true,
      primaryKey: true
    },
    hmacKey: {
      comment: 'The HMAC secret for this TNT address used on this Node.',
      type: Sequelize.STRING,
      validate: {
        is: ['^[a-f0-9]{64}$', 'i']
      },
      field: 'hmac_key',
      allowNull: false,
      unique: true
    },
    version: {
      comment: 'Version of this HMAC secret key.',
      type: Sequelize.INTEGER,
      validate: {
        isInt: true
      },
      field: 'version',
      allowNull: false
    }
  },
  {
    // enable timestamps
    timestamps: true,
    // don't use camelcase for automatically added attributes but underscore style
    // so updatedAt will be updated_at
    underscored: true,
    // Disable the modification of table names; By default, sequelize will automatically
    // transform all passed model names (first parameter of define) into plural.
    // if you don't want that, set the following
    freezeTableName: true
  }
)

module.exports = {
  sequelize: sequelize,
  HMACKey: HMACKey
}
