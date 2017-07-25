// load environment variables
const env = require('./parse-env.js')

const { promisify } = require('util')
const dns = require('dns')
const utils = require('./utils.js')

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
      throw new Error(`Could not query chainpoint.org DNS : ${error.message}`)
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
        throw new Error(`Could not add CoreHostTXT item to Redis : ${error.message}`)
      }
    }

    // select a random CoreHost from the set to mark as current
    let currentCoreHost
    try {
      currentCoreHost = await redis.srandmemberAsync('CoreHostTXT')
    } catch (error) {
      throw new Error(`Could not get random CoreHostTXT item from Redis : ${error.message}`)
    }

    // set the selected CoreHost as current
    await setCurrentCoreHostAsync(currentCoreHost)
    console.log(`CoreHost selected from DNS : ${currentCoreHost}`)
  } else {
    console.log(`Using CHAINPOINT_CORE_API_BASE_URI env variable : ${env.CHAINPOINT_CORE_API_BASE_URI}`)
  }
}

async function getCurrentCoreHostAsync () {
  try {
    return await redis.getAsync('CurrentCoreHost')
  } catch (error) {
    throw new Error(`Could not get CurrentCoreHost in Redis : ${error.message}`)
  }
}

async function setCurrentCoreHostAsync (coreUri) {
  try {
    await redis.setAsync('CurrentCoreHost', coreUri)
  } catch (error) {
    throw new Error(`Could not set CurrentCoreHost in Redis : ${error.message}`)
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

module.exports = {
  initCoreHostsFromDNSAsync: initCoreHostsFromDNSAsync,
  getCurrentCoreUriAsync: getCurrentCoreUriAsync,
  setRedis: (redisClient) => { redis = redisClient }
}
