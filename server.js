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

const _ = require('lodash')
const validator = require('validator')

// load environment variables
const env = require('./lib/parse-env.js')

const apiServer = require('./lib/api-server.js')
const calendarBlock = require('./lib/models/CalendarBlock.js')
const publicKey = require('./lib/models/PublicKey.js')
const hmacKey = require('./lib/models/HMACKey.js')
const utils = require('./lib/utils.js')
const calendar = require('./lib/calendar.js')
const publicKeys = require('./lib/public-keys.js')
const coreHosts = require('./lib/core-hosts.js')
const r = require('redis')
const crypto = require('crypto')
const moment = require('moment')
const ip = require('ip')
const bluebird = require('bluebird')
const url = require('url')
const { version } = require('./package.json')

// the interval at which the service queries the calendar for new blocks
const CALENDAR_UPDATE_SECONDS = 300

// the interval at which the service validates recent entries in the Node calendar
const CALENDAR_VALIDATE_RECENT_SECONDS = 60

// the interval at which the service validates the entire Node calendar
const CALENDAR_VALIDATE_ALL_SECONDS = 1800

// the interval at which the service calculates the Core challenge solution
const SOLVE_CHALLENGE_INTERVAL_MS = 1000 * 60 * 30 // 30 minutes

// pull in variables defined in shared sequelize modules
let sequelizeCalBlock = calendarBlock.sequelize
let sequelizePubKey = publicKey.sequelize
let sequelizeHMACKey = hmacKey.sequelize
let HMACKey = hmacKey.HMACKey

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

// Opens a Redis connection
function openRedisConnection (redisURI) {
  redis = r.createClient(redisURI)

  redis.on('ready', () => {
    bluebird.promisifyAll(redis)
    apiServer.setRedis(redis)
    calendar.setRedis(redis)
    coreHosts.setRedis(redis)
  })

  redis.on('error', async () => {
    redis.quit()
    redis = null
    apiServer.setRedis(null)
    calendar.setRedis(null)
    coreHosts.setRedis(null)
    console.error('Redis : not available. Will retry in 5 seconds...')
    await utils.sleepAsync(5000)
    openRedisConnection(redisURI)
  })
}

// Ensure that the URI provided is valid
// Returns either a valid public URI that can be registered, or null
async function validateUriAsync (nodeUri) {
  if (_.isEmpty(nodeUri)) return null

  // Valid URI with restrictions
  // Blacklisting 0.0.0.0 since its not considered a private IP
  let isValidURI = validator.isURL(nodeUri, {
    protocols: ['http', 'https'],
    require_protocol: true,
    host_blacklist: ['0.0.0.0']
  })

  let parsedURIHost = url.parse(nodeUri).hostname

  // Valid IPv4 IP address
  let uriHasValidIPHost = validator.isIP(parsedURIHost, 4)

  if (isValidURI && uriHasValidIPHost && !ip.isPrivate(parsedURIHost)) {
    return nodeUri
  } else {
    return null
  }
}

// establish a connection with the database
async function openStorageConnectionAsync () {
  let storageConnected = false
  let retryCount = 0
  while (!storageConnected) {
    try {
      await sequelizeCalBlock.sync({ logging: false })
      await sequelizePubKey.sync({ logging: false })
      await sequelizeHMACKey.sync({ logging: false })
      storageConnected = true
    } catch (error) {
      if (retryCount >= 1) {
        console.error('PostgreSQL : not available : Will retry in 5 seconds...')
      }
      retryCount += 1
      await utils.sleepAsync(5000)
    }
  }
}

async function registerNodeAsync (nodeURI) {
  let isRegistered = false
  let registerAttempts = 1
  const maxRegisterAttempts = 12
  const retryWaitTimeMs = 5 * 1000

  while (!isRegistered) {
    try {
      // Check if HMAC key for current TNT address already exists
      let hmacEntry
      try {
        hmacEntry = await HMACKey.findOne({ where: { tntAddr: env.NODE_TNT_ADDRESS } })
      } catch (error) {
        console.error(`ERROR : Registration : Unable to load auth key`)
        // Exit 1 : this is a recoverable error that might be resolved on container restart.
        process.exit(1)
      }

      if (hmacEntry) {
        console.log(`INFO : Registration : Ethereum Address : ${hmacEntry.tntAddr}`)
        console.log('INFO : Registration : HMAC Key Found')
        // console.log(`INFO : Registration : Key : ${hmacEntry.hmacKey}`)
        // The HMACKey exists, so read the key and PUT Node info with HMAC to Core
        let hash = crypto.createHmac('sha256', hmacEntry.hmacKey)
        let dateString = moment().utc().format('YYYYMMDDHHmm')
        let hmacTxt = [hmacEntry.tntAddr, nodeURI, dateString].join('')
        let calculatedHMAC = hash.update(hmacTxt).digest('hex')

        let putObject = {
          tnt_addr: hmacEntry.tntAddr,
          public_uri: nodeURI,
          hmac: calculatedHMAC
        }

        let putOptions = {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'PUT',
          uri: `/nodes/${hmacEntry.tntAddr}`,
          body: putObject,
          json: true,
          gzip: true,
          resolveWithFullResponse: true
        }

        try {
          console.log('INFO : Registration : Attempting Core update using ETH/HMAC/IP')
          await coreHosts.coreRequestAsync(putOptions)
        } catch (error) {
          if (error.statusCode === 409) {
            if (error.error && error.error.code && error.error.message) {
              console.error(`ERROR : Registration update failed : Exiting : ${nodeURI} : ${error.error.code} : ${error.error.message}`)
            } else if (error.error && error.error.code) {
              console.error(`ERROR : Registration update failed : Exiting : ${nodeURI} : ${error.error.code}`)
            } else {
              console.error(`ERROR : Registration update failed : Exiting`)
            }

            // A 409 InvalidArgumentError or ConflictError is an unrecoverable Error : Exit cleanly (!)
            // so Docker Compose `on-failure` policy won't force a restart since this
            // situation will not resolve itself.
            process.exit(0)
          }

          if (error.statusCode) {
            if (error.error && error.error.message) {
              throw new Error(`${error.statusCode} : ${error.error.message}`)
            }
            let err = { statusCode: error.statusCode }
            throw err
          }

          throw new Error(`No response received on update : ${error.message}`)
        }

        isRegistered = true

        if (nodeURI) {
          console.log(`INFO : Registration : Public URI : ${nodeURI}`)
        } else {
          console.log(`INFO : Registration : Public URI : (no public URI)`)
        }

        console.log(`INFO : ***********************************`)
        console.log(`INFO : Registration : Update OK!`)
        console.log(`INFO : ***********************************`)

        return hmacEntry.hmacKey
      } else {
        // If this is the first Registration attempt we want to log to the
        // console that registration requests are starting
        if (registerAttempts === 1) {
          console.log(`INFO : Registration : HMAC Auth Key Not Found : Attempting Registration...`)
        }

        // the HMACKey doesn't exist, so POST Node info to Core and store resulting HMAC key
        let postObject = {
          tnt_addr: env.NODE_TNT_ADDRESS,
          public_uri: nodeURI
        }

        let postOptions = {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST',
          uri: `/nodes`,
          body: postObject,
          json: true,
          gzip: true,
          resolveWithFullResponse: true
        }

        try {
          let response = await coreHosts.coreRequestAsync(postOptions)
          isRegistered = true

          try {
            // write new hmac entry
            let writeHMACKey = response.hmac_key
            await HMACKey.create({ tntAddr: env.NODE_TNT_ADDRESS, hmacKey: writeHMACKey, version: 1 })
            // read hmac entry that was just written
            let newHMACEntry = await HMACKey.findOne({ where: { tntAddr: env.NODE_TNT_ADDRESS } })
            // confirm the two are the same
            if (!newHMACEntry || (newHMACEntry.hmacKey !== writeHMACKey)) {
              throw new Error(`Unable to confirm authentication key with read after write.`)
            }
          } catch (error) {
            console.error(`ERROR : Registration : HMAC Auth key write and confirm failed.`)
            // Exit 1 : this is a recoverable error that might be resolved on container restart.
            process.exit(1)
          }
          console.log(`INFO : Registration : HMAC Auth key saved!`)

          console.log(`INFO : ***********************************`)
          console.log(`INFO : Registration : New Registration OK!`)
          console.log(`INFO : ***********************************`)

          return response.hmac_key
        } catch (error) {
          if (error.statusCode === 409) {
            if (error.error && error.error.code && error.error.message) {
              console.error(`ERROR : Registration : ${nodeURI} : ${error.error.code} : ${error.error.message}`)
            } else if (error.error && error.error.code) {
              console.error(`ERROR : Registration : ${nodeURI} : ${error.error.code}`)
            } else {
              console.error(`ERROR : Registration`)
            }

            // A 409 InvalidArgumentError or ConflictError is an unrecoverable Error : Exit cleanly (!)
            // so Docker Compose `on-failure` policy won't force a restart since this
            // situation will not resolve itself.
            process.exit(0)
          }

          if (error.statusCode) {
            let codeInt
            try {
              codeInt = parseInt(error.statusCode)
            } catch (innerError) {
              throw new Error(`${error.statusCode}`)
            }
            if (codeInt >= 400 && codeInt <= 500 && error.error && error.error.message) {
              throw new Error(`${error.statusCode} : ${error.error.message}`)
            } else {
              throw new Error(`${error.statusCode}`)
            }
          }
          throw new Error(`no response received`)
        }
      }
    } catch (error) {
      if (error.statusCode) {
        console.error(`ERROR : Registration : Core : ${registerAttempts}/${maxRegisterAttempts} : ${error.statusCode} : Retrying...`)
      } else {
        console.error(`ERROR : Registration : Core : ${registerAttempts}/${maxRegisterAttempts} : ${error.message} : Retrying...`)
      }

      registerAttempts += 1
      if (registerAttempts >= maxRegisterAttempts) {
        // We've retried with no success
        // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
        // won't force a restart since this situation will not resolve itself.
        console.error(`ERROR : ********************************************`)
        console.error(`ERROR : Registration : Failed : Max Retries Reached!`)
        console.error(`ERROR : ********************************************`)
        process.exit(0)
      }

      await utils.sleepAsync(retryWaitTimeMs)
    }
  }
}

async function initPublicKeysAsync (coreConfig) {
  // check to see if public keys exists in database
  try {
    let pubKeys = await publicKeys.getLocalPublicKeysAsync()
    if (!pubKeys) {
      // if no public keys are present in database, store keys from coreConfig in DB and return them
      await publicKeys.storeConfigPubKeyAsync(coreConfig.public_keys)
      pubKeys = await publicKeys.getLocalPublicKeysAsync()
    }
    return pubKeys
  } catch (error) {
    throw new Error(`Registration : Unable to initialize Core public keys.`)
  }
}

// synchronize Node calendar with Core calendar, retreive all missing blocks
async function syncNodeCalendarAsync (coreConfig, pubKeys) {
  // pull down Core calendar until Node calendar is in sync, startup = true
  await calendar.syncNodeCalendarAsync(true, coreConfig, pubKeys)
}

// start all functions meant to run on a periodic basis
function startIntervals (coreConfig) {
  // start the interval process for keeping the calendar data up to date
  calendar.startPeriodicUpdateAsync(coreConfig, CALENDAR_UPDATE_SECONDS * 1000)
  // start the interval processes for validating Node calendar data
  calendar.startValidateRecentNodeAsync(CALENDAR_VALIDATE_RECENT_SECONDS * 1000)
  calendar.startValidateFullNodeAsync(CALENDAR_VALIDATE_ALL_SECONDS * 1000)
  // start the interval processes for calculating the solution to the Core audit challenge
  calendar.startCalculateChallengeSolutionAsync(SOLVE_CHALLENGE_INTERVAL_MS)
}

// process all steps need to start the application
async function startAsync () {
  try {
    console.log(`INFO : App : Starting : Version ${version}`)
    openRedisConnection(env.REDIS_CONNECT_URI)
    await coreHosts.initCoreHostsFromDNSAsync()
    let nodeUri = await validateUriAsync(env.CHAINPOINT_NODE_PUBLIC_URI)
    await openStorageConnectionAsync()
    let hmacKey = await registerNodeAsync(nodeUri)
    apiServer.setHmacKey(hmacKey)
    let coreConfig = await coreHosts.getCoreConfigAsync()
    let pubKeys = await initPublicKeysAsync(coreConfig)

    await apiServer.startAsync()
    // start the interval processes for aggregating and submitting hashes to Core
    apiServer.startAggInterval()
    apiServer.setPublicKeySet(pubKeys)
    await calendar.initNodeTopBlockAsync()
    console.log('INFO : Calendar : Starting Sync...')
    await syncNodeCalendarAsync(coreConfig, pubKeys)
    startIntervals(coreConfig)
    console.log('INFO : Calendar : Sync completed!')
    scheduleRestifyRestart()
  } catch (err) {
    console.error(`ERROR : App : Startup : ${err}`)
    // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
    // won't force a restart since this situation will not resolve itself.
    process.exit(0)
  }
}

// get the whole show started
startAsync()

function scheduleRestifyRestart () {
  // schedule restart for a random time within the next 12-24 hours
  // this prevents all Nodes from restarting at the same time
  // additionally prevent scheduling near audit periods
  let minMS = 60 * 60 * 12 * 1000 // 12 hours
  let maxMS = 60 * 60 * 24 * 1000 // 24 hours
  let randomMS
  let inAuditRange
  do {
    randomMS = utils.randomIntFromInterval(minMS, maxMS)
    let targetMinute = moment().add(randomMS, 'ms').minute()
    inAuditRange = ((targetMinute >= 14) && (targetMinute < 20)) || ((targetMinute >= 44) && (targetMinute < 50))
  } while (inAuditRange)

  console.log(`INFO : App : auto-restart scheduled for ${moment().add(randomMS, 'ms').format()}`)
  setTimeout(async () => {
    console.log('INFO : App : Performing scheduled daily auto-restart.')
    await apiServer.restartRestifyAsync()
    // schedule the next restart
    scheduleRestifyRestart()
  }, randomMS)
}
