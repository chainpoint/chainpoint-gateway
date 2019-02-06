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
const env = require('./lib/parse-env.js')

const apiServer = require('./lib/api-server.js')
const { version } = require('./package.json')
const eventMetrics = require('./lib/event-metrics.js')
const rocksDB = require('./lib/models/RocksDB.js')
const utils = require('./lib/utils.js')

// establish a connection with the database
async function openStorageConnectionAsync() {
  await rocksDB.openConnectionAsync()
}

// process all steps need to start the application
async function startAsync() {
  try {
    console.log(`INFO : App : Startup : Version ${version}`)
    await openStorageConnectionAsync()

    // TODO:  Replace commented code below with code for new discovery model
    // Set current Core host from CHAINPOINT_CORE_API_BASE_URI variable
    // or from a random selection using Core discovery
    // await coreHosts.initCoreHostsFromDNSAsync()

    // Validate CHAINPOINT_NODE_PUBLIC_URI, CHAINPOINT_NODE_PRIVATE_URI & CHAINPOINT_NODE_REFLECTED_URI if either env variable is set in .env
    utils.validateNodeUri(env.CHAINPOINT_NODE_PUBLIC_URI, false)
    if (env.CHAINPOINT_NODE_PRIVATE_URI && env.CHAINPOINT_NODE_PRIVATE_URI !== 'empty') {
      utils.validateNodeUri(env.CHAINPOINT_NODE_PRIVATE_URI, true)
    }
    if (env.CHAINPOINT_NODE_REFLECTED_URI && env.CHAINPOINT_NODE_REFLECTED_URI !== 'empty') {
      utils.validateReflectedUri(env.CHAINPOINT_NODE_REFLECTED_URI)
    }

    // TODO:  Replace commented code below with code for new registration model
    // Set current Core host from CHAINPOINT_CORE_API_BASE_URI variable
    // or from a random selection using Core discovery
    // let hmacKey = await registerNodeAsync(nodeUri)
    // apiServer.setHmacKey(hmacKey)

    await eventMetrics.loadMetricsAsync()
    await apiServer.startAsync()

    // start the interval processes for aggregating and submitting hashes to Core
    apiServer.startAggInterval()

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
