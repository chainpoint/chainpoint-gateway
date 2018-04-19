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

const fs = require('fs')
const path = require('path')
const env = require('../parse-env.js')
const calendarBlock = require('../models/CalendarBlock.js')
const hmacKey = require('../models/HMACKey.js')
const coreHosts = require('../core-hosts.js')
const { version } = require('../../package.json')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

let CalendarBlock = calendarBlock.CalendarBlock
let HMACKey = hmacKey.HMACKey

/**
 * GET /config handler
 *
 * Returns a configuration information object
 */
async function getConfigInfoV1Async (req, res, next) {
  let topNodeBlock = await CalendarBlock.findOne({ attributes: ['id'], order: [['id', 'DESC']] })
  // get solution from redis
  let challengeResponse = await redis.getAsync('challenge_response')

  res.contentType = 'application/json'

  res.send({
    version: version,
    proof_expire_minutes: env.PROOF_EXPIRE_MINUTES,
    get_proofs_max_rest: env.GET_PROOFS_MAX_REST,
    post_hashes_max: env.POST_HASHES_MAX,
    post_verify_proofs_max: env.POST_VERIFY_PROOFS_MAX,
    time: new Date().toISOString(),
    calendar: {
      height: topNodeBlock ? parseInt(topNodeBlock.id) : -1,
      audit_response: challengeResponse || null
    }
  })
  return next()
}

/**
 * GET /config handler
 *
 * Returns a configuration information object
 */
async function postBackupAuthKeysV1Async (req, res, next) {
  res.contentType = 'application/json'

  try {
    let result = await HMACKey.findAll().then((keys) => {
      return keys.map((currVal) => {
        fs.writeFileSync(`${path.resolve('../../keys/backup')}/${currVal.tnt_addr}-${Date.now()}.key`, currVal.hmac_key)

        return `${currVal.tnt_addr} hmac key has been backed up`
      })
    })

    res.send(200, result)

    return next()
  } catch (_) {
    console.error(`ERROR : BackupAuthKeys : Unable to generate backups for Auth Keys.`)
    res.send(500, 'Unable to generate backups for Auth Keys.')
  }
}

module.exports = {
  getConfigInfoV1Async: getConfigInfoV1Async,
  postBackupAuthKeysV1Async: postBackupAuthKeysV1Async,
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
    redis = redisClient
  }
}
