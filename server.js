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
const CALENDAR_UPDATE_SECONDS = 15

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
    console.log('Redis connection established')
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

// ensure that the public Uri provided is a valid public ip if an ip is supplied
async function validatePublicUriAsync () {
  let publicUri = env.CHAINPOINT_NODE_PUBLIC_URI || null
  if (!publicUri) return null

  let parsedPublicUri = url.parse(publicUri)
  // ensure the proper protocol is in use
  if (['http:', 'https:'].indexOf(parsedPublicUri.protocol.toLowerCase()) === -1) throw new Error('Invalid scheme in CHAINPOINT_NODE_PUBLIC_URI')
  // ensure, if hostname is an IP, that it is not a private IP
  if (ip.isV4Format(parsedPublicUri.hostname)) {
    if (ip.isPrivate(parsedPublicUri.hostname)) throw new Error('Private IPs not allowed in CHAINPOINT_NODE_PUBLIC_URI')
  }
  // disallow localhost
  if (parsedPublicUri.hostname === 'localhost') throw new Error('localhost not allowed in CHAINPOINT_NODE_PUBLIC_URI')
  // disallow 0.0.0.0
  if (parsedPublicUri.hostname === '0.0.0.0') throw new Error('0.0.0.0 not allowed in CHAINPOINT_NODE_PUBLIC_URI')

  if (parsedPublicUri.port) {
    let nodePort
    try {
      nodePort = parseInt(parsedPublicUri.port)
    } catch (error) {
      throw new Error('Invalid port value in CHAINPOINT_NODE_PUBLIC_URI')
    }
    if (nodePort < 1 || nodePort > 65535) throw new Error('Invalid port value in CHAINPOINT_NODE_PUBLIC_URI')
  }

  return publicUri
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
      console.log('Successfully established Postgres connection')
    } catch (error) {
      console.error('Cannot establish Postgres connection. Attempting in 5 seconds...')
      await utils.sleepAsync(5000)
    }
  }
}

async function registerNodeAsync (publicUri) {
  let isRegistered = false
  let registerAttempts = 0
  while (!isRegistered) {
    try {
      // Check if HMAC key for current TNT address already exists
      let hmacEntry
      try {
        hmacEntry = await NodeHMAC.findOne({ where: { tntAddr: env.NODE_TNT_ADDRESS } })
      } catch (error) {
        console.error(`Unable to read NodeHMAC data: ${error.message}`)
        process.exit(1)
      }
      if (hmacEntry) {
        console.log(`Using existing NodeHMAC for TNT address ${hmacEntry.tntAddr}`)
        // the NodeHMAC exists, so read the key and PUT Node info with HMAC to Core
        let hash = crypto.createHmac('sha256', hmacEntry.hmacKey)
        let dateString = moment().utc().format('YYYYMMDDHHmm')
        let hmacTxt = [hmacEntry.tntAddr, publicUri, dateString].join('')
        let calculatedHMAC = hash.update(hmacTxt).digest('hex')

        let putObject = {
          tnt_addr: hmacEntry.tntAddr,
          public_uri: publicUri || undefined,
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
          if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.message}`)
          throw new Error(`No response received on PUT node : ${error.message}`)
        }

        isRegistered = true
        console.log('Node registration confirmed and updated')

        return hmacEntry.hmacKey
      } else {
        console.log(`A NodeHMAC does not exist locally for TNT address ${env.NODE_TNT_ADDRESS}`)
        // the NodeHMAC doesnt exist, so POST Node info to Core and store resulting HMAC key
        let postObject = {
          tnt_addr: env.NODE_TNT_ADDRESS,
          public_uri: publicUri || undefined
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
              throw new Error(`Write and read values do not match`)
            }
          } catch (error) {
            console.error(`Unable to write and confirm NodeHMAC data: ${error.message}`)
            process.exit(1)
          }
          console.log(`Node registration added and HMAC saved for TNT address ${env.NODE_TNT_ADDRESS}`)

          return response.hmac_key
        } catch (error) {
          if (error.statusCode === 409) {
            // the TNT address is already in use with an existing hmac key
            // if the hmac key was lost, you need to re-register with a new
            // TNT address and receive a new hmac key
            console.error(`TNT address ${env.NODE_TNT_ADDRESS} cannot be registered, it is already registered and in use with an existing HMAC key`)
            process.exit(1)
          }
          if (error.statusCode) throw new Error(`Invalid response : ${error.statusCode} : ${error.message}`)
          throw new Error(`No response received on POST node : ${error.message}`)
        }
      }
    } catch (error) {
      console.error('Unable register Node with Core. Retrying in 5 seconds...')
      if (++registerAttempts >= 5) {
        // We've tried 5 times with no success, display error an exit
        console.error('Unable to register Node with Core after 5 attempts, exiting : ' + error)
        process.exit(1)
      }
      await utils.sleepAsync(5000)
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
    console.log(`Public key values initialized`)
    return pubKeys
  } catch (error) {
    throw new Error(`Unable to initialize public key values : ${error.message}`)
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
    let publicUri = await validatePublicUriAsync()
    await openStorageConnectionAsync()
    let hmacKey = await registerNodeAsync(publicUri)
    console.log(`Using private auth key (back me up!): ${hmacKey}`)
    apiServer.setHmacKey(hmacKey)
    let coreConfig = await coreHosts.getCoreConfigAsync()
    let pubKeys = await initPublicKeysAsync(coreConfig)
    await startListeningAsync()
    console.log('Syncing local calendar with Core')
    await syncNodeCalendarAsync(coreConfig, pubKeys)
    startIntervals(coreConfig)
    console.log('startup completed successfully')
  } catch (err) {
    console.error(`An error has occurred on startup: ${err}`)
    process.exit(1)
  }
}

// get the whole show started
startAsync()
