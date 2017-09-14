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

const restify = require('restify')
const env = require('../parse-env.js')
const utils = require('../utils.js')
const async = require('async')
const uuidValidate = require('uuid-validate')
const uuidTime = require('uuid-time')
const chpBinary = require('chainpoint-binary')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

// The custom MIME type for JSON proof array results containing Base64 encoded proof data
const BASE64_MIME_TYPE = 'application/vnd.chainpoint.json+base64'

// The custom MIME type for JSON proof array results containing Base64 encoded proof data
const JSONLD_MIME_TYPE = 'application/vnd.chainpoint.ld+json'

/**
 * GET /proofs/:hash_id handler
 *
 * Expects a path parameter 'hash_id' in the form of a Version 1 UUID
 *
 * Returns a chainpoint proof for the requested Hash ID
 */
function getProofsByIDV1 (req, res, next) {
  let hashIdResults = []

  // check if hash_id parameter was included
  if (req.params && req.params.hash_id_node) {
    // a hash_id was specified in the url, so use that hash_id only

    if (!uuidValidate(req.params.hash_id_node, 1)) {
      return next(new restify.InvalidArgumentError('invalid request, bad hash_id'))
    }

    hashIdResults.push(req.params.hash_id_node)
  } else if (req.headers && req.headers.hashids) {
    // no hash_id was specified in url, read from headers.hashids
    hashIdResults = req.headers.hashids.split(',')
  }

  // ensure at least one hash_id was submitted
  if (hashIdResults.length === 0) {
    return next(new restify.InvalidArgumentError('invalid request, at least one hash id required'))
  }

  // ensure that the request count does not exceed the maximum setting
  if (hashIdResults.length > env.GET_PROOFS_MAX_REST) {
    return next(new restify.InvalidArgumentError('invalid request, too many hash ids (' + env.GET_PROOFS_MAX_REST + ' max)'))
  }

  // prepare results array to hold proof results
  hashIdResults = hashIdResults.map((hashId) => {
    return { hash_id_node: hashId.trim(), proof: null, anchors_complete: [] }
  })
  let requestedType = req.accepts(JSONLD_MIME_TYPE) ? JSONLD_MIME_TYPE : BASE64_MIME_TYPE

  async.eachLimit(hashIdResults, 50, (hashIdResult, callback) => {
    // validate id param is proper UUIDv1
    if (!uuidValidate(hashIdResult.hash_id_node, 1)) return callback(null)
    // validate uuid time is in in valid range
    let uuidEpoch = parseInt(uuidTime.v1(hashIdResult.hash_id_node))
    var nowEpoch = new Date().getTime()
    let uuidDiff = nowEpoch - uuidEpoch
    let maxDiff = env.PROOF_EXPIRE_MINUTES * 60 * 1000
    if (uuidDiff > maxDiff) return callback(null)
    // retrieve proof from storage
    redis.get(hashIdResult.hash_id_node, (err, proofBase64) => {
      if (err) return callback(null)
      chpBinary.binaryToObject(proofBase64, (err, proofObj) => {
        if (err) return callback(null)
        let anchorsComplete = utils.parseAnchorsComplete(proofObj)
        hashIdResult.anchors_complete = anchorsComplete
        if (requestedType === BASE64_MIME_TYPE) {
          hashIdResult.proof = proofBase64
          return callback(null)
        } else {
          hashIdResult.proof = proofObj
          return callback(null)
        }
      })
    })
  }, (err) => {
    if (err) return next(new restify.InternalError(err))
    res.contentType = 'application/json'
    res.send(hashIdResults)
    return next()
  })
}

module.exports = {
  getProofsByIDV1: getProofsByIDV1,
  setRedis: (redisClient) => { redis = redisClient }
}
