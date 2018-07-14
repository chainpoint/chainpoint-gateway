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
const _ = require('lodash')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

const PROCESS_EVENTS_INTERVAL_SECONDS = 1
// An accumulation of events from various parts of the Node
let EVENT_LOG = []
// An accumulation of recent hashes received
let RECENT_HASH_DATA = []

async function processAccumulatedEventsAsync () {
  let accumulatedEvents = EVENT_LOG.splice(0)
  let last25hashes = RECENT_HASH_DATA.splice(0).splice(-25)
  let multi = redis.multi()

  for (let event of accumulatedEvents) {
    let eventType = event.eventType
    let incrementValue = event.eventValue
    multi.incrbyAsync(`nodestats:${eventType}:${moment.utc().year()}`, incrementValue)
    multi.incrbyAsync(`nodestats:${eventType}:${moment.utc().year()}:${moment.utc().month()}`, incrementValue)
    multi.incrbyAsync(`nodestats:${eventType}:${moment.utc().year()}:${moment.utc().month()}:${moment.utc().date()}`, incrementValue)
    // Set TTL to nodeStats:<year>:<month>:<day>:<hour> to (86400 * 3)
    if (_.isNull((await redis.getAsync(`nodestats:${eventType}:${moment.utc().year()}:${moment.utc().month()}:${moment.utc().date()}:${moment.utc().hour()}`)))) {
      multi.setAsync(`nodestats:${eventType}:${moment.utc().year()}:${moment.utc().month()}:${moment.utc().date()}:${moment.utc().hour()}`, 0, 'EX', 86400 * 3)
    }
    multi.incrbyAsync(`nodestats:${eventType}:${moment.utc().year()}:${moment.utc().month()}:${moment.utc().date()}:${moment.utc().hour()}`, incrementValue)
  }

  for (let hashData of last25hashes) {
    multi.lpushAsync('nodestats:hashes:last:25', hashData)
  }
  multi.ltrimAsync('nodestats:hashes:last:25', 0, 25)

  try {
    // Execute Redis Transaction
    await multi.execAsync()
  } catch (e) {
    return console.error('Could not save statistical data')
  }
}

async function captureEvent (type, value) {
  EVENT_LOG.push({ eventType: type, eventValue: value })
}

async function logRecentHash (hashIdNode, hash, submittedAt) {
  RECENT_HASH_DATA.push(`${hashIdNode}|${hash}|${submittedAt}`)
}

setInterval(processAccumulatedEventsAsync, PROCESS_EVENTS_INTERVAL_SECONDS * 1000)

module.exports = {
  setRedis: (r) => { redis = r },
  captureEvent: (type, value) => { captureEvent(type, value) },
  logRecentHash: (hashIdNode, hash, submittedAt) => { logRecentHash(hashIdNode, hash, submittedAt) }
}
