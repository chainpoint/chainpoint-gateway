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
const calendarBlock = require('../models/CalendarBlock.js').CalendarBlock
const coreHosts = require('../core-hosts.js')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null
let blockHashKeyPrefix = 'BlockHashKey'
let blockDataKeyPrefix = 'BlockData'

/**
 * GET /calendar/:height handler
 *
 * Expects a path parameter 'height' as an integer
 *
 * Returns block object for calendar block by calendar height
 */
async function getCalBlockByHeightV1Async (req, res, next) {
  res.contentType = 'application/json'

  let height = parseInt(req.params.height, 10)

  // ensure that :height is an integer
  if (!_.isInteger(height) || height < 0) {
    return next(new errors.InvalidArgumentError('Invalid height, must be a positive integer'))
  }

  try {
    let block = await calendarBlock.findOne({ where: { id: height } })
    if (!block) block = await getBlockFromCoreByHeightAsync(height)
    block.id = parseInt(block.id, 10)
    block.time = parseInt(block.time, 10)
    block.version = parseInt(block.version, 10)
    res.send(block)
    return next()
  } catch (error) {
    if (error.statusCode === 404) return next(new errors.NotFoundError())
    return next(new errors.InternalError('Node internal error retrieving Calendar block by height'))
  }
}

/**
 * GET /calendar/:height/hash handler
 *
 * Expects a path parameter 'height' as an integer
 *
 * Returns hash for calendar block by calendar height
 */
async function getCalBlockHashByHeightV1Async (req, res, next) {
  res.contentType = 'application/json'

  let height = parseInt(req.params.height, 10)

  // ensure that :height is an integer
  if (!_.isInteger(height) || height < 0) {
    return next(new errors.InvalidArgumentError('Invalid height, must be a positive integer'))
  }

  try {
    let hash = await getRedisValueForKeyAsync(`${blockHashKeyPrefix}-${height}`)
    if (!hash) {
      let block = await calendarBlock.findOne({ where: { id: height }, attributes: ['hash'] })
      if (block) {
        hash = block.hash
      } else {
        hash = await getBlockHashFromCoreByHeightAsync(height)
      }
      await setRedisValueForKeyAsync(`${blockHashKeyPrefix}-${height}`, hash, 1440)
    }

    res.contentType = 'text/plain'
    res.cache('public', { maxAge: 2592000 })
    res.send(hash)
    return next()
  } catch (error) {
    return next(new errors.InternalError('Node internal error retrieving Calendar block by height'))
  }
}

/**
 * GET /calendar/:height/data handler
 *
 * Expects a path parameter 'height' as an integer
 *
 * Returns data value for calendar block by calendar height
 */
async function getCalBlockDataByHeightV1Async (req, res, next) {
  res.contentType = 'application/json'

  let height = parseInt(req.params.height, 10)

  // ensure that :height is an integer
  if (!_.isInteger(height) || height < 0) {
    return next(new errors.InvalidArgumentError('Invalid height, must be a positive integer'))
  }

  try {
    let dataVal = await getRedisValueForKeyAsync(`${blockDataKeyPrefix}-${height}`)
    if (!dataVal) {
      let block = await calendarBlock.findOne({ where: { id: height }, attributes: ['dataVal'] })
      if (block) {
        dataVal = block.dataVal
      } else {
        dataVal = await getBlockDataFromCoreByHeightAsync(height)
      }
      await setRedisValueForKeyAsync(`${blockDataKeyPrefix}-${height}`, dataVal, 1440)
    }

    res.contentType = 'text/plain'
    res.cache('public', { maxAge: 2592000 })
    res.send(dataVal)
    return next()
  } catch (error) {
    return next(new errors.InternalError('Node internal error retrieving Calendar block by height'))
  }
}

async function getBlockFromCoreByHeightAsync (height) {
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

async function getBlockHashFromCoreByHeightAsync (height) {
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

async function getBlockDataFromCoreByHeightAsync (height) {
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

async function getRedisValueForKeyAsync (key) {
  let hash
  try {
    hash = await redis.getAsync(key)
  } catch (error) {
    return null
  }
  return hash
}

async function setRedisValueForKeyAsync (key, value, expireMinutes) {
  try {
    await redis.setAsync(key, value, 'EX', expireMinutes * 60)
  } catch (error) {
    return null
  }
}

module.exports = {
  getCalBlockByHeightV1Async: getCalBlockByHeightV1Async,
  getCalBlockHashByHeightV1Async: getCalBlockHashByHeightV1Async,
  getCalBlockDataByHeightV1Async: getCalBlockDataByHeightV1Async,
  setRedis: (redisClient) => {
    coreHosts.setRedis(redisClient)
    redis = redisClient
  }
}
