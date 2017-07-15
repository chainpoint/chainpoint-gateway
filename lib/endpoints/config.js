const env = require('../parse-env.js')
const utils = require('../utils.js')

/**
 * GET /config handler
 *
 * Returns a configuration information object
 */
function getConfigInfoV1 (req, res, next) {
  res.send({
    node_public_uri: env.NODE_PUBLIC_URI,
    node_tnt_address: env.NODE_TNT_ADDRESS,
    chainpoint_core_api_base_uri: env.CHAINPOINT_CORE_API_BASE_URI,
    proof_expire_minutes: env.PROOF_EXPIRE_MINUTES,
    get_proofs_max_rest: env.GET_PROOFS_MAX_REST,
    post_hashes_max: env.POST_HASHES_MAX,
    post_verify_proofs_max: env.POST_VERIFY_PROOFS_MAX,
    get_calendar_blocks_max: env.GET_CALENDAR_BLOCKS_MAX,
    time: utils.formatDateISO8601NoMs(new Date())
  })
  return next()
}

module.exports = {
  getConfigInfoV1: getConfigInfoV1
}
