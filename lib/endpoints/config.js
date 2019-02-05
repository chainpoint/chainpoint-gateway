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

const env = require('../parse-env.js')
const { version } = require('../../package.json')

/**
 * GET /config handler
 *
 * Returns a configuration information object
 */
async function getConfigInfoAsync(req, res, next) {
  res.contentType = 'application/json'

  // TODO: Prune these items, are they really necessary anymore?
  res.send(
    Object.assign(
      {},
      {
        version: version,
        proof_expire_minutes: env.PROOF_EXPIRE_MINUTES,
        get_proofs_max_rest: env.GET_PROOFS_MAX_REST,
        post_hashes_max: env.POST_HASHES_MAX,
        post_verify_proofs_max: env.POST_VERIFY_PROOFS_MAX,
        time: new Date().toISOString()
      }
    )
  )
  return next()
}

module.exports = {
  getConfigInfoAsync: getConfigInfoAsync
}
