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
const env = require('./parse-env.js')

const rp = require('request-promise-native')
const { version } = require('../package.json')
const retry = require('async-retry')
const rocksDB = require('./models/RocksDB.js')

// TODO: Replace initCoreHostsFromDNSAsync with new discovery model function
// Much of this will need replacing to support the new discovery model

/*
async function initCoreHostsFromDNSAsync() {
  if (env.CHAINPOINT_CORE_API_BASE_URI === 'http://0.0.0.0') {
    let resolveTxtAsync = promisify(dns.resolveTxt)

    // retrieve Core URI txt entries from chainpoint.org DNS
    let hosts
    try {
      hosts = await resolveTxtAsync('_core.addr.chainpoint.org')
    } catch (error) {
      throw new Error('Could not query chainpoint.org DNS')
    }
    if (hosts.length === 0) throw new Error('No Core instance DNS enteries located')

    // convert results to single dimension array
    hosts = hosts.map(hostArray => {
      return hostArray[0]
    })

    // add results to Rocks CoreHostTXT set
    try {
      await rocksDB.setAsync(
        'CoreHostTXT',
        JSON.stringify({
          hosts: hosts
        })
      )
    } catch (error) {
      throw new Error('Could not add CoreHostTXT item to Rocks')
    }

    // select a random CoreHost from the set to mark as current
    let currentCoreHost = hosts[Math.floor(Math.random() * hosts.length)]

    // set the selected CoreHost as current
    await setCurrentCoreHostAsync(currentCoreHost)
    console.log(`INFO : App : Core Host : ${currentCoreHost}`)
  } else {
    // set the pre-configured CoreHost as current
    let envHost = url.parse(env.CHAINPOINT_CORE_API_BASE_URI).host
    await setCurrentCoreHostAsync(envHost)
    console.log(`INFO : App : Core Host : ${env.CHAINPOINT_CORE_API_BASE_URI}`)
  }
}
*/

async function getCurrentCoreHostAsync() {
  try {
    return await rocksDB.getAsync('CurrentCoreHost')
  } catch (error) {
    throw new Error('Could not get CurrentCoreHost in Rocks')
  }
}

// TODO: Uncomment when new discovery model is implemented

/*
async function setCurrentCoreHostAsync(coreUri) {
  try {
    await rocksDB.setAsync('CurrentCoreHost', coreUri)
  } catch (error) {
    console.error(error.message)
    throw new Error('Could not set CurrentCoreHost in Rocks')
  }
}
*/

async function getCurrentCoreUriAsync() {
  if (env.CHAINPOINT_CORE_API_BASE_URI === 'http://0.0.0.0') {
    let currentCoreHost = await getCurrentCoreHostAsync()
    return `https://${currentCoreHost}`
  } else {
    return env.CHAINPOINT_CORE_API_BASE_URI
  }
}

async function coreRequestAsync(options) {
  let coreUri = await getCurrentCoreUriAsync()
  options.headers['X-Node-Version'] = version
  options.headers['X-Node-Address'] = env.NODE_TNT_ADDRESS
  options.uri = `${coreUri}${options.uri}`

  // Capture misc. options
  let miscOptions = options.misc
    ? JSON.parse(JSON.stringify(options.misc))
    : {
        retries: 3
      }
  delete options.misc

  let response
  await retry(
    async bail => {
      try {
        response = await rp(options)
      } catch (error) {
        // If no response was received or there is a status code >= 500, then we should retry the call, throw an error
        if (!error.statusCode || error.statusCode >= 500) throw error
        // errors like 409 Conflict or 400 Bad Request are not retried because the request is bad and will never succeed
        bail(error)
      }
    },
    {
      retries: miscOptions.retries, // The maximum amount of times to retry the operation. Default is 3
      factor: 1, // The exponential factor to use. Default is 2
      minTimeout: 200, // The number of milliseconds before starting the first retry. Default is 200
      maxTimeout: 400,
      randomize: true,
      onRetry: error => {
        console.log(`INFO : Core request : ${error.statusCode || 'no response'} : retrying`)
      }
    }
  )

  return response.body
}

module.exports = {
  getCurrentCoreUriAsync: getCurrentCoreUriAsync,
  getCurrentCoreHostAsync: getCurrentCoreHostAsync,
  coreRequestAsync: coreRequestAsync
}
