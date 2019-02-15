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

const moment = require('moment')
let rocksDB = require('./models/RocksDB.js')

const PERSIST_DATA_INTERVAL_SECONDS = 1

// An object containing all the count metrics key value pairs
let COUNT_METRICS = {}
// An array containing all the most recent hashes received
let RECENT_HASH_DATA = []
const RECENT_HASH_COUNT = 25

let IS_INITIALIZED = false

function getKeyNamesForTypeAndTimestamp(type, timestamp) {
  let utc = moment.utc(timestamp)
  let yearStatsKey = `nodestats:counter:${utc.format('YYYY')}`
  let monthStatsKey = `${yearStatsKey}:${utc.format('MM')}`
  let dateStatsKey = `${monthStatsKey}:${utc.format('DD')}`
  let hourStatsKey = `${dateStatsKey}:${utc.format('HH')}`
  return [yearStatsKey, monthStatsKey, dateStatsKey, hourStatsKey].map(key => `${key}:${type}`)
}

function getLast24HourKeysForType(type, timestamp = Date.now()) {
  let utc = moment.utc(timestamp)
  let keys = []
  for (let x = 0; x < 24; x++) {
    keys.push(`nodestats:counter:${utc.format('YYYY:MM:DD:HH')}:${type}`)
    utc.add(-1, 'h')
  }
  return keys
}

function getMetricByKey(key) {
  return COUNT_METRICS[key] || 0
}

function getMetricsObjectArray() {
  let results = []
  for (let key in COUNT_METRICS) {
    results.push({
      key: key,
      value: COUNT_METRICS[key]
    })
  }
  return results
}

async function captureEvent(type, count, timestamp = Date.now()) {
  let keys = getKeyNamesForTypeAndTimestamp(type, timestamp)
  for (let key of keys) {
    COUNT_METRICS[key] = COUNT_METRICS[key] ? COUNT_METRICS[key] + count : count
  }
}

async function logRecentHash(hashIdNode, hash, submittedAt) {
  RECENT_HASH_DATA.unshift({ hashIdNode, hash, submittedAt })
  // truncate the array if it grows larger than RECENT_HASH_COUNT
  if (RECENT_HASH_DATA.length > RECENT_HASH_COUNT) RECENT_HASH_DATA.length = RECENT_HASH_COUNT
}

function getMetricsByTypeAndTimestamp(type, timestamp) {
  let keys = getKeyNamesForTypeAndTimestamp(type, timestamp)
  let last24HrsSum = getLast24HourKeysForType(type, timestamp)
    .map(key => getMetricByKey(key))
    .reduce((sum, value) => sum + value, 0)
  return {
    year: getMetricByKey(keys[0]),
    month: getMetricByKey(keys[1]),
    day: getMetricByKey(keys[2]),
    last24Hrs: last24HrsSum,
    hour: getMetricByKey(keys[3])
  }
}

function getRecentHashDataFlattenedArray() {
  return RECENT_HASH_DATA.slice(0, 25).map(item => {
    return `${item.hashIdNode}|${item.hash}|${item.submittedAt}`
  })
}

function getRecentHashDataObjectArray() {
  return RECENT_HASH_DATA.slice(0, 25)
}

function pruneHoulyMetricDataOlderThan(timestamp) {
  let prunedKeys = []
  // find all keys that fit the regex pattern for an hourly key
  for (let key in COUNT_METRICS) {
    let matchInfo = key.match(/^nodestats:counter:(\d{4}:\d{2}:\d{2}:\d{2}):.+$/)
    // for each match, parse the date/time from the key
    if (matchInfo != null) {
      // if that date/time is older than timestamp, delete the metric
      let keyTimestamp = moment.utc(matchInfo[1], 'YYYY:MM:DD:HH').valueOf()
      if (keyTimestamp < timestamp) {
        delete COUNT_METRICS[key]
        prunedKeys.push(key)
      }
    }
  }
  return prunedKeys
}

async function persistDataAsync() {
  if (!IS_INITIALIZED) return
  // Prune expired metrics, returning keys pruned from COUNT_METRICS
  let prunedKeys = pruneHoulyMetricDataOlderThan(
    moment
      .utc(Date.now())
      .add(-3, 'd')
      .valueOf()
  )
  // Save latest COUNT_METRICS data
  try {
    await rocksDB.saveCountMetricsAsync(getMetricsObjectArray(), prunedKeys)
  } catch (error) {
    console.error('ERROR : Could not save updated count metrics')
  }
  // Save latest RECENT_HASH_DATA values
  try {
    await rocksDB.saveRecentHashDataAsync(getRecentHashDataObjectArray())
  } catch (error) {
    console.error('ERROR : Could not save recent hash data metrics')
  }
}

async function loadMetricsAsync() {
  // Retrieve last known COUNT_METRICS data
  try {
    let countMetricsObjects = await rocksDB.getCountMetricsAsync()
    COUNT_METRICS = countMetricsObjects.reduce((result, item) => {
      result[item.key] = item.value
      return result
    }, {})
  } catch (error) {
    console.error('ERROR : Could not save updated count metrics')
    return
  }
  // Retrieve last known RECENT_HASH_DATA values
  try {
    RECENT_HASH_DATA = await rocksDB.getRecentHashDataAsync()
  } catch (error) {
    console.error('ERROR : Could not save recent hash data metrics')
    return
  }
  IS_INITIALIZED = true
}

function startPersistDataInterval() {
  return setInterval(persistDataAsync, PERSIST_DATA_INTERVAL_SECONDS * 1000)
}

module.exports = {
  captureEvent: captureEvent,
  logRecentHash: logRecentHash,
  getMetricsByTypeAndTimestamp: getMetricsByTypeAndTimestamp,
  getRecentHashDataFlattenedArray: getRecentHashDataFlattenedArray,
  loadMetricsAsync: loadMetricsAsync,
  startPersistDataInterval: startPersistDataInterval,
  // additional functions for testing purposes
  persistDataAsync: persistDataAsync,
  setRocksDB: db => {
    rocksDB = db
  },
  getCountMetrics: () => COUNT_METRICS,
  resetCountMetrics: () => {
    COUNT_METRICS = {}
  },
  getRecentHashData: () => RECENT_HASH_DATA,
  resetRecentHashData: () => {
    RECENT_HASH_DATA = []
  },
  setInitialized: state => {
    IS_INITIALIZED = state
  }
}
