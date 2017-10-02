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

// load environment variables
const env = require('./parse-env.js')

const { promisify } = require('util')
const dns = require('dns')
const utils = require('./utils.js')
const rp = require('request-promise-native')
const { version } = require('../package.json')

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null
let redisAvailable = () => { return redis !== null }

async function initCoreHostsFromDNSAsync () {
  // wait for redis to become available if not already so
  while (!redisAvailable()) {
    await utils.sleepAsync(100)
  }

  if (env.CHAINPOINT_CORE_API_BASE_URI === '') {
    let resolveTxtAsync = promisify(dns.resolveTxt)

    // retrieve Core URI txt entries from chainpoint.org DNS
    let hosts
    try {
      hosts = await resolveTxtAsync('_core.addr.chainpoint.org')
    } catch (error) {
      throw new Error(`Could not query chainpoint.org DNS`)
    }
    if (hosts.length === 0) throw new Error('No Core instance DNS enteries located')

    // convert results to single dimension array
    hosts = hosts.map((hostArray) => {
      return hostArray[0]
    })

    // add results to Redis CoreHostTXT set
    for (let x = 0; x < hosts.length; x++) {
      try {
        await redis.saddAsync('CoreHostTXT', hosts[x])
      } catch (error) {
        throw new Error(`Could not add CoreHostTXT item to Redis`)
      }
    }

    // select a random CoreHost from the set to mark as current
    let currentCoreHost
    try {
      currentCoreHost = await redis.srandmemberAsync('CoreHostTXT')
    } catch (error) {
      throw new Error(`Could not get random CoreHostTXT item from Redis`)
    }

    // set the selected CoreHost as current
    await setCurrentCoreHostAsync(currentCoreHost)
    console.log(`INFO : Core host selected : ${currentCoreHost}`)
  } else {
    console.log(`INFO : Using CHAINPOINT_CORE_API_BASE_URI env variable : ${env.CHAINPOINT_CORE_API_BASE_URI}`)
  }
}

async function getCurrentCoreHostAsync () {
  try {
    return await redis.getAsync('CurrentCoreHost')
  } catch (error) {
    throw new Error(`ERROR : Could not get CurrentCoreHost in Redis`)
  }
}

async function setCurrentCoreHostAsync (coreUri) {
  try {
    await redis.setAsync('CurrentCoreHost', coreUri)
  } catch (error) {
    throw new Error(`ERROR : Could not set CurrentCoreHost in Redis`)
  }
}

async function getCurrentCoreUriAsync () {
  if (env.CHAINPOINT_CORE_API_BASE_URI === '') {
    let currentCoreHost = await getCurrentCoreHostAsync()
    return `https://${currentCoreHost}`
  } else {
    return env.CHAINPOINT_CORE_API_BASE_URI
  }
}

async function getCoreConfigAsync () {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: `/config`,
    json: true,
    gzip: true,
    resolveWithFullResponse: true
  }

  let result = await coreRequestAsync(options)
  return result
}

async function coreRequestAsync (options) {
  let coreUri = await getCurrentCoreUriAsync()
  options.headers['X-Node-Version'] = version
  options.headers['X-Node-Address'] = env.NODE_TNT_ADDRESS
  options.uri = `${coreUri}${options.uri}`

  let response = await rp(options)
  return response.body
}

module.exports = {
  initCoreHostsFromDNSAsync: initCoreHostsFromDNSAsync,
  getCurrentCoreUriAsync: getCurrentCoreUriAsync,
  getCoreConfigAsync: getCoreConfigAsync,
  getCurrentCoreHostAsync: getCurrentCoreHostAsync,
  coreRequestAsync: coreRequestAsync,
  setRedis: (redisClient) => { redis = redisClient }
}
