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

// load environment variables
let env = require('../parse-env.js').env

const errors = require('restify-errors')
const _ = require('lodash')
let rocksDB = require('../models/RocksDB.js')

const RECENT_REP_HOURS = 24

/**
 * GET /reputation/:min/:max handler
 *
 */
async function getReputationDataRangeByIdsAsync(req, res, next) {
  res.contentType = 'application/json'

  // validate content-type sent was 'application/json'
  if (req.contentType() !== 'application/json') {
    return next(new errors.InvalidArgumentError('invalid content type'))
  }

  let minId = parseInt(req.params.min, 10)
  let maxId = parseInt(req.params.max, 10)

  // ensure that :min is an integer
  if (!_.isInteger(minId) || minId < 0) {
    return next(new errors.InvalidArgumentError('invalid request, min id must be a positive integer'))
  }

  // ensure that :max is an integer
  if (!_.isInteger(maxId) || minId < 0) {
    return next(new errors.InvalidArgumentError('invalid request, max id must be a positive integer'))
  }

  // ensure that :max > :min
  if (maxId < minId) {
    return next(new errors.InvalidArgumentError('invalid request, max must be greater than or equal to min'))
  }

  // ensure that total requested is <= GET_REPUTATION_MAX
  if (maxId - minId + 1 > env.GET_REPUTATION_MAX) {
    return next(new errors.InvalidArgumentError(`invalid request, limit of ${env.GET_REPUTATION_MAX} per request`))
  }

  // retrieve the reputation items
  let repItems = await rocksDB.getReputationItemsRangeByIdsAsync(minId, maxId)
  if (repItems.length === 0) return next(new errors.NotFoundError())

  // retrieve the reputation proofs
  let repProofs = await rocksDB.getReputationItemProofsRangeByRepIdsAsync(minId, maxId)

  // create a reputation proof lookup object keyed by id
  repProofs = repProofs.reduce((result, item) => {
    result[`proof_${item.id}`] = item.proof
    return result
  }, {})

  // add proofs to reputation items
  for (let item of repItems) {
    item.proof = JSON.parse(repProofs[`proof_${item.id}`]) || null
  }

  res.send(repItems)
  return next()
}

/**
 * GET /reputation/:id handler
 *
 */
async function getReputationDataByIdAsync(req, res, next) {
  res.contentType = 'application/json'

  // validate content-type sent was 'application/json'
  if (req.contentType() !== 'application/json') {
    return next(new errors.InvalidArgumentError('invalid content type'))
  }

  let id = parseInt(req.params.id, 10)

  // ensure that :id is an integer
  if (!_.isInteger(id) || id < 0) {
    return next(new errors.InvalidArgumentError('invalid request, id must be a positive integer'))
  }

  // retrieve the reputation item
  let repItem = await rocksDB.getReputationItemByIdAsync(id)
  if (repItem === null) return next(new errors.NotFoundError())

  // retrieve the reputation proof
  let repProof = await rocksDB.getReputationItemProofByRepIdAsync(id)

  // add proofs to reputation items
  repItem.proof = JSON.parse(repProof) || null

  res.send(repItem)
  return next()
}

/**
 * GET /reputation/recent handler
 *
 */
async function getRecentReputationDataAsync(req, res, next) {
  let maxTimestamp = Date.now()
  let minTimestamp = maxTimestamp - RECENT_REP_HOURS * 60 * 60 * 1000

  // retrieve the recent reputation items
  let repItems = await rocksDB.getReputationItemsBetweenAsync(minTimestamp, maxTimestamp)
  if (repItems.length === 0) return next(new errors.NotFoundError())
  // retrieve the recent reputation proofs
  let minId = repItems[0].id
  let maxId = repItems[repItems.length - 1].id
  let repProofs = await rocksDB.getReputationItemProofsRangeByRepIdsAsync(minId, maxId)

  // create a reputation proof lookup object keyed by id
  repProofs = repProofs.reduce((result, item) => {
    result[`proof_${item.id}`] = item.proof
    return result
  }, {})

  // add proofs to reputation items
  for (let item of repItems) {
    item.proof = JSON.parse(repProofs[`proof_${item.id}`]) || null
  }

  res.send(repItems)
  return next()
}

module.exports = {
  getReputationDataRangeByIdsAsync: getReputationDataRangeByIdsAsync,
  getReputationDataByIdAsync: getReputationDataByIdAsync,
  getRecentReputationDataAsync: getRecentReputationDataAsync,
  // additional functions for testing purposes
  setRocksDB: db => {
    rocksDB = db
  }
}
