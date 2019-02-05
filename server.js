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

const _ = require('lodash')
const validator = require('validator')

// load environment variables
const env = require('./lib/parse-env.js')

const apiServer = require('./lib/api-server.js')
const ip = require('ip')
const url = require('url')
const { version } = require('./package.json')
const eventMetrics = require('./lib/event-metrics.js')
const rocksDB = require('./lib/models/RocksDB.js')

// Ensure that the URI provided is valid
// Returns either a valid public URI that can be registered, or null
function validateNodeUri(nodeURI, asPrivate) {
  if (_.isEmpty(nodeURI)) return null

  // Valid URI with restrictions
  // Blacklisting 0.0.0.0 since its not considered a private IP
  let isValidURI = validator.isURL(nodeURI, {
    protocols: ['http', 'https'],
    require_protocol: true,
    host_blacklist: ['0.0.0.0']
  })

  let parsedURI = url.parse(nodeURI)
  let parsedURIHost = parsedURI.hostname
  let uriHasValidPort = !!(parsedURI.port === null || parsedURI.port === '80')
  let uriHasValidIPHost = validator.isIP(parsedURIHost, 4)

  if (
    isValidURI &&
    uriHasValidIPHost &&
    (asPrivate ? ip.isPrivate(parsedURIHost) : !ip.isPrivate(parsedURIHost)) &&
    uriHasValidPort
  ) {
    return nodeURI
  } else if (isValidURI && uriHasValidIPHost && !asPrivate && ip.isPrivate(parsedURIHost)) {
    throw new Error(
      `RFC1918 Private IP Addresses like "${parsedURIHost}" cannot be specified as CHAINPOINT_NODE_PUBLIC_URI`
    )
  } else if (isValidURI && uriHasValidIPHost && asPrivate && !ip.isPrivate(parsedURIHost)) {
    throw new Error(`CHAINPOINT_NODE_PRIVATE_URI must be a RFC1918 Private IP Addresses`)
  } else if (!uriHasValidPort) {
    throw new Error('CHAINPOINT_NODE_PUBLIC_URI only supports the use of port 80')
  } else {
    return null
  }
}

function validateReflectedUri(val) {
  const enumerals = ['public', 'private']

  if (!enumerals.includes(val))
    throw new Error('CHAINPOINT_NODE_REFLECTED_URI only accepts a value of "public" or "private"')
  else if (
    (!env.CHAINPOINT_NODE_PUBLIC_URI || env.CHAINPOINT_NODE_PUBLIC_URI === 'http://0.0.0.0') &&
    (!env.CHAINPOINT_NODE_PRIVATE_URI || env.CHAINPOINT_NODE_PRIVATE_URI === 'empty')
  )
    throw new Error(
      'CHAINPOINT_NODE_REFLECTED_URI requires that a valid value be set for "CHAINPOINT_NODE_PUBLIC_URI" or "CHAINPOINT_NODE_PRIVATE_URI"'
    )
  else if (
    !env[`CHAINPOINT_NODE_${val.toUpperCase()}_URI`] ||
    env[`CHAINPOINT_NODE_${val.toUpperCase()}_URI`] === 'empty' ||
    env[`CHAINPOINT_NODE_${val.toUpperCase()}_URI`] === 'http://0.0.0.0'
  )
    throw new Error(
      `${`CHAINPOINT_NODE_${val.toUpperCase()}_URI`} is required as it has been set as the CHAINPOINT_NODE_REFLECTED_URI`
    )
}

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
    validateNodeUri(env.CHAINPOINT_NODE_PUBLIC_URI, false)
    if (env.CHAINPOINT_NODE_PRIVATE_URI && env.CHAINPOINT_NODE_PRIVATE_URI !== 'empty') {
      validateNodeUri(env.CHAINPOINT_NODE_PRIVATE_URI, true)
    }
    if (env.CHAINPOINT_NODE_REFLECTED_URI && env.CHAINPOINT_NODE_REFLECTED_URI !== 'empty') {
      validateReflectedUri(env.CHAINPOINT_NODE_REFLECTED_URI)
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
