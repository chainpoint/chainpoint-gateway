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

const env = require('../parse-env.js')
const calendarBlock = require('../models/CalendarBlock.js')
const coreHosts = require('../core-hosts.js')
const {version} = require('../../package.json')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

let CalendarBlock = calendarBlock.CalendarBlock

/**
 * GET /config handler
 *
 * Returns a configuration information object
 */
async function getConfigInfoV1Async (req, res, next) {
  let topNodeBlock = await CalendarBlock.findOne({ attributes: ['id'], order: [['id', 'DESC']] })
  // get solution from redis
  let challengeResponse = await redis.getAsync('challenge_response')

  res.send({
    version: version,
    chainpoint_node_public_scheme: env.CHAINPOINT_NODE_PUBLIC_SCHEME || null,
    chainpoint_node_public_addr: env.CHAINPOINT_NODE_PUBLIC_ADDR || null,
    chainpoint_node_port: parseInt(env.CHAINPOINT_NODE_PORT),
    node_tnt_address: env.NODE_TNT_ADDRESS,
    chainpoint_core_api_base_uri: await coreHosts.getCurrentCoreUriAsync(),
    proof_expire_minutes: env.PROOF_EXPIRE_MINUTES,
    get_proofs_max_rest: env.GET_PROOFS_MAX_REST,
    post_hashes_max: env.POST_HASHES_MAX,
    post_verify_proofs_max: env.POST_VERIFY_PROOFS_MAX,
    get_calendar_blocks_max: env.GET_CALENDAR_BLOCKS_MAX,
    time: new Date().toISOString(),
    calendar: {
      height: parseInt(topNodeBlock.id),
      audit_response: `${challengeResponse}`
    }
  })
  return next()
}

module.exports = {
  getConfigInfoV1Async: getConfigInfoV1Async,
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
    redis = redisClient
  }
}
