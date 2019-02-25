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
const env = require('./lib/parse-env.js').env

const apiServer = require('./lib/api-server.js')
const aggregator = require('./lib/aggregator.js')
const { version } = require('./package.json')
const eventMetrics = require('./lib/event-metrics.js')
const rocksDB = require('./lib/models/RocksDB.js')
const utils = require('./lib/utils.js')
const cachedProofs = require('./lib/cached-proofs.js')
const cores = require('./lib/cores.js')

// The number of Cores to maintain healthy connection to
// Also, the number of Cores that each aggregation root will be submitted to
const CORE_CONNECTION_COUNT = 3

// establish a connection with the database
async function openStorageConnectionAsync() {
  await rocksDB.openConnectionAsync()
}

// process all steps need to start the application
async function startAsync() {
  try {
    console.log(`INFO : App : Startup : Version ${version}`)
    await openStorageConnectionAsync()

    // Establish Core connection(s) using Core discovery or provided CHAINPOINT_CORE_CONNECT_IP_LIST values
    await cores.connectAsync(CORE_CONNECTION_COUNT)

    // Validate CHAINPOINT_NODE_PUBLIC_URI, CHAINPOINT_NODE_PRIVATE_URI & CHAINPOINT_NODE_REFLECTED_URI if either env variable is set in .env
    utils.validateNodeUri(env.CHAINPOINT_NODE_PUBLIC_URI, false)
    if (env.CHAINPOINT_NODE_PRIVATE_URI && env.CHAINPOINT_NODE_PRIVATE_URI !== 'empty') {
      utils.validateNodeUri(env.CHAINPOINT_NODE_PRIVATE_URI, true)
    }
    if (env.CHAINPOINT_NODE_REFLECTED_URI && env.CHAINPOINT_NODE_REFLECTED_URI !== 'empty') {
      utils.validateReflectedUri(env.CHAINPOINT_NODE_REFLECTED_URI)
    }

    // TODO:  Replace commented code below with code for new registration model
    // let hmacKey = await registerNodeAsync(nodeUri)
    // apiServer.setHmacKey(hmacKey)

    await eventMetrics.loadMetricsAsync()
    await apiServer.startAsync()

    // start the interval processes for refreshing the IP blocklist
    apiServer.startIPBlacklistRefreshInterval()

    // start the interval processes for aggregating and submitting hashes to Core
    aggregator.startAggInterval()

    // start the interval processes for pruning expired proof state data from RocksDB
    rocksDB.startPruningInterval()

    // start the interval processes for pruning cached proof data from memory
    cachedProofs.startPruneExpiredItemsInterval()

    // start the interval processes for pruning cached transaction data from memory
    cores.startPruneExpiredItemsInterval()

    // start the interval processes for saving event metrics data
    eventMetrics.startPersistDataInterval()

    console.log(`INFO : App : Startup : Complete`)
  } catch (err) {
    console.error(`ERROR : App : Startup : ${err}`)
    // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
    // won't force a restart since this situation will not resolve itself.
    process.exit(0)
  }
}

// get the whole show started
startAsync()
