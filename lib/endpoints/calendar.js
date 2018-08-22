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

const _ = require('lodash')
const errors = require('restify-errors')
const coreHosts = require('../core-hosts.js')
const rocksDB = require('../models/RocksDB.js')

// These objects contain the cached calendar block data elements
// This cache serves to prevent multiple request for the same data from Core
// Once the full block is received in a completed block range from Core,
// the cached data for that block is deleted for the cache, and future
// requests for that data are served from the local database.
let CACHED_BLOCK_HASHES = {}
let CACHED_DATA_VALUES = {}

/**
 * GET /calendar/:height handler
 *
 * Expects a path parameter 'height' as an integer
 *
 * Returns block object for calendar block by calendar height
 */
async function getCalBlockByHeightV1Async(req, res, next) {
  res.contentType = 'application/json'

  let height = parseInt(req.params.height, 10)

  // ensure that :height is an integer
  if (!_.isInteger(height) || height < 0) {
    return next(
      new errors.InvalidArgumentError(
        'Invalid height, must be a positive integer'
      )
    )
  }

  try {
    let block = await rocksDB.getCalendarBlockByHeightAsync(height)
    if (!block) block = await getBlockFromCoreByHeightAsync(height)
    block.id = parseInt(block.id, 10)
    block.time = parseInt(block.time, 10)
    block.version = parseInt(block.version, 10)
    res.send(block)
    return next()
  } catch (error) {
    if (error.statusCode === 404) return next(new errors.NotFoundError())
    return next(
      new errors.InternalError(
        'Node internal error retrieving Calendar block by height'
      )
    )
  }
}

/**
 * GET /calendar/:height/hash handler
 *
 * Expects a path parameter 'height' as an integer
 *
 * Returns hash for calendar block by calendar height
 */
async function getCalBlockHashByHeightV1Async(req, res, next) {
  res.contentType = 'application/json'

  let height = parseInt(req.params.height, 10)

  // ensure that :height is an integer
  if (!_.isInteger(height) || height < 0) {
    return next(
      new errors.InvalidArgumentError(
        'Invalid height, must be a positive integer'
      )
    )
  }

  // Try to read the block hash value from local storage first
  // If it is not found, check the local cache before asking Core
  // If all else fails, retrieve the value from Core, and store in cache
  let hash = null
  try {
    let block = await rocksDB.getCalendarBlockByHeightAsync(height)
    if (block) {
      hash = block.hash
    } else {
      hash = CACHED_BLOCK_HASHES[height]
      if (!hash) {
        hash = await getBlockHashFromCoreByHeightAsync(height)
        if (hash) CACHED_BLOCK_HASHES[height] = hash
      }
    }
    res.contentType = 'text/plain'
    res.cache('public', { maxAge: 2592000 })
    res.send(hash)
    return next()
  } catch (error) {
    return next(
      new errors.InternalError(
        'Node internal error retrieving Calendar block by height'
      )
    )
  }
}

/**
 * GET /calendar/:height/data handler
 *
 * Expects a path parameter 'height' as an integer
 *
 * Returns data value for calendar block by calendar height
 */
async function getCalBlockDataByHeightV1Async(req, res, next) {
  res.contentType = 'application/json'

  let height = parseInt(req.params.height, 10)

  // ensure that :height is an integer
  if (!_.isInteger(height) || height < 0) {
    return next(
      new errors.InvalidArgumentError(
        'Invalid height, must be a positive integer'
      )
    )
  }

  // Try to read the block dataVal value from local storage first
  // If it is not found, check the local cache before asking Core
  // If all else fails, retrieve the value from Core, and store in cache
  let dataVal = null
  try {
    let block = await rocksDB.getCalendarBlockByHeightAsync(height)
    if (block) {
      dataVal = block.dataVal
    } else {
      dataVal = CACHED_DATA_VALUES[height]
      if (!dataVal) {
        dataVal = await getBlockDataFromCoreByHeightAsync(height)
        if (dataVal) CACHED_DATA_VALUES[height] = dataVal
      }
    }

    res.contentType = 'text/plain'
    res.cache('public', { maxAge: 2592000 })
    res.send(dataVal)
    return next()
  } catch (error) {
    return next(
      new errors.InternalError(
        'Node internal error retrieving Calendar block by height'
      )
    )
  }
}

async function getBlockFromCoreByHeightAsync(height) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: `/calendar/${height}`,
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let response = await coreHosts.coreRequestAsync(options)

  return response
}

async function getBlockHashFromCoreByHeightAsync(height) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: `/calendar/${height}/hash`,
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let response = await coreHosts.coreRequestAsync(options)

  return response
}

async function getBlockDataFromCoreByHeightAsync(height) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: `/calendar/${height}/data`,
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let response = await coreHosts.coreRequestAsync(options)

  return response
}

function pruneCache(startId, endId) {
  for (let x = startId; x <= endId; x++) {
    if (CACHED_BLOCK_HASHES[x]) delete CACHED_BLOCK_HASHES[x]
    if (CACHED_DATA_VALUES[x]) delete CACHED_DATA_VALUES[x]
  }
}

module.exports = {
  getCalBlockByHeightV1Async: getCalBlockByHeightV1Async,
  getCalBlockHashByHeightV1Async: getCalBlockHashByHeightV1Async,
  getCalBlockDataByHeightV1Async: getCalBlockDataByHeightV1Async,
  pruneCache: pruneCache
}
