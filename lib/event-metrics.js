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
const rocksDB = require('./models/RocksDB.js')

const PERSIST_DATA_INTERVAL_SECONDS = 1

// An object containing all the count metrics key value pairs
let COUNT_METRICS = {}
// An array containing all the most recent hashes received
let RECENT_HASH_DATA = []
const RECENT_HASH_COUNT = 25

function getKeyNamesForTypeAndTimestamp (type, timestamp) {
  let utc = moment.utc(timestamp)
  let yearStatsKey = `nodestats:${type}:${utc.format('YYYY')}`
  let monthStatsKey = `${yearStatsKey}:${utc.format('MM')}`
  let dateStatsKey = `${monthStatsKey}:${utc.format('DD')}`
  let hourStatsKey = `${dateStatsKey}:${utc.format('HH')}`
  return [yearStatsKey, monthStatsKey, dateStatsKey, hourStatsKey]
}

function getLast24HourKeysForType (type) {
  let utc = moment.utc(Date.now())
  let keys = []
  for (let x = 0; x < 24; x++) {
    keys.push(`nodestats:${type}:${utc.format('YYYY:MM:DD:HH')}`)
    utc.add(-1, 'h')
  }
  return keys
}

function getMetricByKey (key) {
  return COUNT_METRICS[key] || 0
}

function getMetricsObjectArray () {
  let results = []
  for (let key in COUNT_METRICS) {
    results.push({
      key: key,
      value: COUNT_METRICS[key]
    })
  }
  return results
}

async function captureEvent (type, count) {
  let keys = getKeyNamesForTypeAndTimestamp(type, Date.now())
  for (let key of keys) {
    COUNT_METRICS[key] = COUNT_METRICS[key] ? COUNT_METRICS[key] + count : count
  }
}

async function logRecentHash (hashIdNode, hash, submittedAt) {
  RECENT_HASH_DATA.unshift({ hashIdNode, hash, submittedAt })
  // truncate the array if it grows larger than RECENT_HASH_COUNT
  if (RECENT_HASH_DATA.length > RECENT_HASH_COUNT) RECENT_HASH_DATA.length = RECENT_HASH_COUNT
}

function getMetricsByTypeAndTimestamp (type, timestamp) {
  let keys = getKeyNamesForTypeAndTimestamp(type, timestamp)
  let last24HrsSum = getLast24HourKeysForType(type).map((key) => getMetricByKey(key)).reduce((sum, value) => sum + value, 0)
  return {
    year: getMetricByKey(keys[0]),
    month: getMetricByKey(keys[1]),
    day: getMetricByKey(keys[2]),
    last24Hrs: last24HrsSum,
    hour: getMetricByKey(keys[3])
  }
}

function getRecentHashDataFlattenedArray () {
  return RECENT_HASH_DATA.slice(0, 25).map((item) => {
    return `${item.hashIdNode}|${item.hash}|${item.submittedAt}`
  })
}

function getRecentHashDataObjectArray () {
  return RECENT_HASH_DATA.slice(0, 25)
}

async function persistDataAsync () {
  // Save latest COUNT_METRICS data
  try {
    await rocksDB.updateCountMetrics(getMetricsObjectArray())
  } catch (error) {
    console.error(`ERROR : Could not save updated count metrics`)
  }
  // Save latest RECENT_HASH_DATA values
  try {
    await rocksDB.updateRecentHashDataAsync(getRecentHashDataObjectArray())
  } catch (error) {
    console.error(`ERROR : Could not save recent hash data metrics`)
  }
}

setInterval(persistDataAsync, PERSIST_DATA_INTERVAL_SECONDS * 1000)

module.exports = {
  captureEvent: (type, value) => { captureEvent(type, value) },
  logRecentHash: (hashIdNode, hash, submittedAt) => { logRecentHash(hashIdNode, hash, submittedAt) },
  getMetricsByTypeAndTimestamp: getMetricsByTypeAndTimestamp,
  getRecentHashDataFlattenedArray: getRecentHashDataFlattenedArray
}
