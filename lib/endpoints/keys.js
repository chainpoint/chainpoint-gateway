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
const hmacKey = require('../models/HMACKey.js')

let HMACKey = hmacKey.HMACKey

/**
 * GET /backup-auth-keys method handler
 *
 * Returns an array of HMAC keys that have been backed to /keys/backups
 */
async function postBackupAuthKeysV1Async (req, res, next) {
  res.contentType = 'application/json'

  try {
    let result = await HMACKey.findAll().then((keys) => {
      return keys.map((currVal) => {
        let key = currVal.get({plain: true})

        fs.writeFileSync(`${path.resolve('./keys/backups')}/${key.tntAddr}-${Date.now()}.key`, key.hmacKey)

        return `${key.tntAddr} hmac key has been backed up`
      })
    })
    res.send(200, result)

    return next()
  } catch (err) {
    console.error(`ERROR : BackupAuthKeys : Unable to generate backups for Auth Keys.`)
    res.send(500, 'Unable to generate backups for Auth Keys.')
  }
}

module.exports = {
  postBackupAuthKeysV1Async: postBackupAuthKeysV1Async
}
