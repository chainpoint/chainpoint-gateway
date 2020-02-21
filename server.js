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
const rocksDB = require('./lib/models/RocksDB.js')
const cachedProofs = require('./lib/cached-proofs.js')
const cores = require('./lib/cores.js')
const logger = require('./lib/logger.js')

// establish a connection with the database
async function openStorageConnectionAsync() {
  await rocksDB.openConnectionAsync()
}

// process all steps need to start the application
async function startAsync() {
  try {
    logger.info(`App : Startup : Version ${version}`)
    // display NETWORK value
    logger.info(`App : Startup : Network : ${env.NETWORK}`)

    await openStorageConnectionAsync()

    await apiServer.startAsync()

    // start the interval processes for refreshing the IP blocklist
    apiServer.startIPBlacklistRefreshInterval()

    // connect to the Cores listed in .env and check/open lightning connections
    await cores.connectAsync()

    // start the interval processes for aggregating and submitting hashes to Core
    aggregator.startAggInterval()

    // start the interval processes for pruning expired proof state data from RocksDB
    rocksDB.startPruningInterval()

    // start the interval processes for pruning cached proof data from memory
    cachedProofs.startPruneExpiredItemsInterval()

    // start the interval processes for pruning cached transaction data from memory
    cores.startPruneExpiredItemsInterval()

    logger.info(`App : Startup : Complete`)
  } catch (err) {
    logger.error(`App : Startup : ${err.message}`)
    // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
    // won't force a restart since this situation will not resolve itself.
    process.exit(0)
  }
}

// get the whole show started
startAsync()
