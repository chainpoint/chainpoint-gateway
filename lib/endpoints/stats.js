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

const moment = require('moment')
const env = require('../parse-env.js')

let redis

async function getLast24HashesReceived () {
  let yesterday = moment.utc().subtract('1', 'd')
  let today = moment.utc()
  let todayKeys = await redis.keysAsync(`nodestats:${today.year()}:${today.month()}:${today.date()}:*`)
  let yesterdayKeys = await redis.keysAsync(`nodestats:${yesterday.year()}:${yesterday.month()}:${yesterday.date()}:*`)

  let hours = [].concat(todayKeys, yesterdayKeys).splice(0, 24)
  return (await Promise.all(hours.map(async (currVal) => {
    return (await redis.getAsync(currVal)) || 0
  })))
  .reduce((sum, i) => {
    sum += parseInt(i, 10)
    return sum
  }, 0)
}

async function getNodeStats (req, res, next) {
  res.contentType = 'application/json'

  // Check if Node UI has been made publicly available
  if (req.headers['auth'] === '' && env.CHAINPOINT_NODE_UI_PASSWORD !== false) {
    res.send(401, 'unauthorized')
    return next()
  }
  // Check if CHAINPOINT_NODE_UI_PASSWORD is set, if it is make sure it matches the 'auth' header
  if ((env.CHAINPOINT_NODE_UI_PASSWORD && (env.CHAINPOINT_NODE_UI_PASSWORD !== req.headers['auth'])) || (!env.CHAINPOINT_NODE_UI_PASSWORD && req.headers['auth'] !== env.NODE_TNT_ADDRESS)) {
    res.send(401, 'unauthorized')
    return next()
  }

  try {
    let result
    let filter

    if (!req.query.filter || req.query.filter === 'last_1_days') {
      filter = 'last_1_days'

      let hashesReceivedToday = await redis.lrangeAsync('nodestats:hashes:last:25', 0, -1)
      let stats = {
        year: parseInt((await redis.getAsync(`nodestats:${moment.utc().year()}`)) || 0, 10),
        month: parseInt((await redis.getAsync(`nodestats:${moment.utc().year()}:${moment.utc().month()}`)) || 0, 10),
        day: parseInt((await redis.getAsync(`nodestats:${moment.utc().year()}:${moment.utc().month()}:${moment.utc().date()}`)) || 0, 10),
        last24Hrs: await getLast24HashesReceived(),
        hour: parseInt((await redis.getAsync(`nodestats:${moment.utc().year()}:${moment.utc().month()}:${moment.utc().date()}:${moment.utc().hour()}`)) || 0, 10)
      }

      result = Object.assign({}, stats, {
        hashesReceivedToday
      })
    }
    res.send(200, {[filter]: result})
    return next()
  } catch (e) {
    res.send(500, 'Something went wrong. Please try again.')
    return next()
  }
}

module.exports = {
  getNodeStatsV1Async: getNodeStats,
  setRedis: (redisClient) => {
    redis = redisClient
  }
}
