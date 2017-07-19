const env = require('../parse-env.js')
const calendarBlock = require('../models/CalendarBlock.js')

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
  let topLocalBlock = await CalendarBlock.findOne({ attributes: ['id'], order: [['id', 'DESC']] })
    // get solution from redis
  let challengeResponse = await redis.getAsync('challenge_response')

  res.send({
    chainpoint_node_public_scheme: env.CHAINPOINT_NODE_PUBLIC_SCHEME || null,
    chainpoint_node_public_addr: env.CHAINPOINT_NODE_PUBLIC_ADDR || null,
    chainpoint_node_port: parseInt(env.CHAINPOINT_NODE_PORT),
    node_tnt_address: env.NODE_TNT_ADDRESS,
    chainpoint_core_api_base_uri: env.CHAINPOINT_CORE_API_BASE_URI,
    proof_expire_minutes: env.PROOF_EXPIRE_MINUTES,
    get_proofs_max_rest: env.GET_PROOFS_MAX_REST,
    post_hashes_max: env.POST_HASHES_MAX,
    post_verify_proofs_max: env.POST_VERIFY_PROOFS_MAX,
    get_calendar_blocks_max: env.GET_CALENDAR_BLOCKS_MAX,
    time: new Date().toISOString(),
    calendar: {
      height: parseInt(topLocalBlock.id),
      audit_response: `${Date.now()}:${challengeResponse}`
    }
  })
  return next()
}

module.exports = {
  getConfigInfoV1Async: getConfigInfoV1Async,
  setRedis: (redisClient) => { redis = redisClient }
}
