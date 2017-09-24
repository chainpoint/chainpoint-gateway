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

const { promisify } = require('util')
const apiServer = require('./lib/api-server.js')
const calendarBlock = require('./lib/models/CalendarBlock.js')
const publicKey = require('./lib/models/PublicKey.js')
const nodeHMAC = require('./lib/models/NodeHMAC.js')
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
let sequelizeNodeHMAC = nodeHMAC.sequelize
let NodeHMAC = nodeHMAC.NodeHMAC

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
    console.log('Redis connection established.')
  })
  redis.on('error', async () => {
    redis.quit()
    redis = null
    apiServer.setRedis(null)
    calendar.setRedis(null)
    coreHosts.setRedis(null)
    console.error('Cannot establish Redis connection. Attempting in 5 seconds...')
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
  while (!storageConnected) {
    try {
      await sequelizeCalBlock.sync({ logging: false })
      await sequelizePubKey.sync({ logging: false })
      await sequelizeNodeHMAC.sync({ logging: false })
      storageConnected = true
      console.log('Postgres connection established.')
    } catch (error) {
      console.error('Cannot establish Postgres connection. Attempting in 5 seconds...')
      await utils.sleepAsync(5000)
    }
  }
}

async function registerNodeAsync (nodeURI) {
  let isRegistered = false
  let registerAttempts = 0

  while (!isRegistered) {
    try {
      // Check if HMAC key for current TNT address already exists
      let hmacEntry
      try {
        hmacEntry = await NodeHMAC.findOne({ where: { tntAddr: env.NODE_TNT_ADDRESS } })
      } catch (error) {
        console.error(`Unable to find local Node authentication key.`)
        process.exit(1)
      }

      // HMAC auth key found!
      if (hmacEntry) {
        console.log(`Found existing Node authentication key for TNT address ${hmacEntry.tntAddr}`)
        // the NodeHMAC exists, so read the key and PUT Node info with HMAC to Core
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
          await coreHosts.coreRequestAsync(putOptions)
        } catch (error) {
          if (error.statusCode === 409) {
            if (error.error.message === 'public_uri') {
              // the public uri is already in use by another Node
              console.error(`Public URI ${nodeURI} is already in use and cannot be registered.`)
            }
            // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
            // won't force a restart since this situation will not resolve itself.
            process.exit(0)
          }
          if (error.statusCode) {
            let err = { statusCode: error.statusCode }
            throw err
          }
          throw new Error(`No response received on PUT node : ${error.message}`)
        }

        isRegistered = true
        console.log('Node registration with Core confirmed and updated.')

        return hmacEntry.hmacKey
      } else {
        console.log(`No local Node authentication key for TNT address ${env.NODE_TNT_ADDRESS}. Registering.`)
        // the NodeHMAC doesn't exist, so POST Node info to Core and store resulting HMAC key
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
            await NodeHMAC.create({ tntAddr: env.NODE_TNT_ADDRESS, hmacKey: writeHMACKey })
            // read hmac entry that was just written
            let newHMACEntry = await NodeHMAC.findOne({ where: { tntAddr: env.NODE_TNT_ADDRESS } })
            // confirm the two are the same
            if (!newHMACEntry || (newHMACEntry.hmacKey !== writeHMACKey)) {
              throw new Error(`Unable to confirm authentication key with read after write.`)
            }
          } catch (error) {
            console.error(`Unable to write and confirm new authentication key locally.`)
            process.exit(1)
          }
          console.log(`Node registered and authentication key saved for TNT address ${env.NODE_TNT_ADDRESS}`)

          return response.hmac_key
        } catch (error) {
          if (error.statusCode === 409) {
            if (error.error.message === 'tnt_addr') {
              // the TNT address is already in use with an existing hmac key
              // if the hmac key was lost, you need to re-register with a new
              // TNT address and receive a new hmac key
              console.error(`TNT address ${env.NODE_TNT_ADDRESS} is already in use and cannot be registered.`)
            } else if (error.error.message === 'public_uri') {
              // the public uri is already in use by another Node
              console.error(`Public URI ${nodeURI} is already in use and cannot be registered.`)
            }
            // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
            // won't force a restart since this situation will not resolve itself.
            process.exit(0)
          }
          if (error.statusCode) throw new Error(`Node registration failed with status code : ${error.statusCode}`)
          throw new Error(`Node registration failed. No response received.`)
        }
      }
    } catch (error) {
      if (error.statusCode) {
        console.error(`ERROR : Unable to register Node with Core: error ${error.statusCode} ...Retrying in 30 seconds...`)
      } else {
        console.error(`ERROR : Unable to register Node with Core: error ${error.message} ...Retrying in 30 seconds...`)
      }

      if (++registerAttempts >= 3) {
        // We've tried 3 times with no success
        // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
        // won't force a restart since this situation will not resolve itself.
        process.exit(0)
      }

      await utils.sleepAsync(30 * 1000)
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
    console.log(`Initial public key import completed.`)
    return pubKeys
  } catch (error) {
    throw new Error(`Unable to initialize Core public keys.`)
  }
}

// instruct restify to begin listening for requests
function startListening (callback) {
  apiServer.api.listen(8080, (err) => {
    if (err) return callback(err)
    // console.log(`${apiServer.api.name} listening at ${apiServer.api.url}`)
    return callback(null)
  })
}

// make awaitable async version for startListening function
let startListeningAsync = promisify(startListening)

// synchronize Node calendar with Core calendar, retreive all missing blocks
async function syncNodeCalendarAsync (coreConfig, pubKeys) {
  // pull down Core calendar until Node calendar is in sync, startup = true
  await calendar.syncNodeCalendarAsync(true, coreConfig, pubKeys)
  apiServer.setCalendarInSync(true)
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
    openRedisConnection(env.REDIS_CONNECT_URI)
    await coreHosts.initCoreHostsFromDNSAsync()
    let nodeUri = await validateUriAsync(env.CHAINPOINT_NODE_PUBLIC_URI)
    await openStorageConnectionAsync()
    let hmacKey = await registerNodeAsync(nodeUri)
    console.log('******************************************************************************')
    console.log(`Node private authentication key (back me up!): ${hmacKey}`)
    console.log('******************************************************************************')
    apiServer.setHmacKey(hmacKey)
    let coreConfig = await coreHosts.getCoreConfigAsync()
    let pubKeys = await initPublicKeysAsync(coreConfig)
    await startListeningAsync()
    console.log('Node syncing local calendar with Core...')
    await syncNodeCalendarAsync(coreConfig, pubKeys)
    startIntervals(coreConfig)
    console.log('Node startup completed successfully!')
  } catch (err) {
    console.error(`ERROR : Startup error : ${err}`)
    // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
    // won't force a restart since this situation will not resolve itself.
    process.exit(0)
  }
}

// get the whole show started
startAsync()
