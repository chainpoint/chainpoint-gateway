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

let env = require('../parse-env.js')
const { isObject } = require('lodash')
const { nodeUIPasswordBooleanCheck } = require('../utils')
let eventMetrics = require('../event-metrics.js')
let rocksDB = require('../models/RocksDB.js')

let registrationStatus = false

async function getNodeStats(req, res, next) {
  res.contentType = 'application/json'

  // Check if Node UI has been made publicly available
  if (
    (!req.headers['auth'] || req.headers['auth'] === '') &&
    nodeUIPasswordBooleanCheck(env.CHAINPOINT_NODE_UI_PASSWORD) !== false
  ) {
    res.send(401, 'Unauthorized: Node is not Public. Please provide a valid authentication header value.')
    return next()
  }
  // Check if CHAINPOINT_NODE_UI_PASSWORD is set, if it is make sure it matches the 'auth' header
  if (
    nodeUIPasswordBooleanCheck(env.CHAINPOINT_NODE_UI_PASSWORD) !== false &&
    ((env.CHAINPOINT_NODE_UI_PASSWORD && env.CHAINPOINT_NODE_UI_PASSWORD !== req.headers['auth']) ||
      (!env.CHAINPOINT_NODE_UI_PASSWORD && req.headers['auth'] !== env.NODE_TNT_ADDRESS))
  ) {
    res.send(401, 'Unauthorized: Please provide a valid authentication header value.')
    return next()
  }

  try {
    let result
    let filter

    if (!req.query.filter || req.query.filter === 'last_1_days') {
      filter = 'last_1_days' // TODO: Determine raison d'etre, remove?

      let recentHashDataFlattenedArray = eventMetrics.getRecentHashDataFlattenedArray()
      let stats = eventMetrics.getMetricsByTypeAndTimestamp('hashes', Date.now())

      result = Object.assign({}, stats, {
        hashesReceivedToday: recentHashDataFlattenedArray
      })
    }

    let nodeData = (await rocksDB.getAsync('dataFromCore')) || {}
    if (!isObject(nodeData)) {
      nodeData = JSON.parse(nodeData)
    }
    res.send(200, {
      [filter]: result,
      nodeData: {
        ...nodeData,
        node_registered: registrationStatus,
        node_public_uri: env.CHAINPOINT_NODE_PUBLIC_URI,
        node_tnt_addr: env.NODE_TNT_ADDRESS,
        dataFromCoreLastReceived: (await rocksDB.getAsync('dataFromCoreLastReceived')) || ''
      }
    })
    return next()
  } catch (e) {
    res.send(500, 'Something went wrong. Please try again.')
    return next()
  }
}

module.exports = {
  getNodeStatsAsync: getNodeStats,
  // additional functions for testing purposes
  setEventMetrics: em => {
    eventMetrics = em
  },
  setRocksDB: db => {
    rocksDB = db
  },
  setENV: obj => {
    env = obj
  }
}
