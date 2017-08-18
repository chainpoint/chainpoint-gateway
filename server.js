// load environment variables
const env = require('./lib/parse-env.js')

const { promisify } = require('util')
const apiServer = require('./lib/api-server.js')
const calendarBlock = require('./lib/models/CalendarBlock.js')
const publicKey = require('./lib/models/PublicKey.js')
const utils = require('./lib/utils.js')
const calendar = require('./lib/calendar.js')
const publicKeys = require('./lib/public-keys.js')
const coreHosts = require('./lib/core-hosts.js')
const r = require('redis')
const fs = require('fs')
const untildify = require('untildify')
const crypto = require('crypto')
const moment = require('moment')
const ip = require('ip')
const bluebird = require('bluebird')

const HMACKEY_DIR = '/home/node/app/.chainpoint'
const HMACKEY_FILENAME = 'node-hmac.key'

// the interval at which the service queries the calendar for new blocks
const CALENDAR_UPDATE_SECONDS = 15

// the interval at which the service audits the entire local calendar
const CALENDAR_RECENT_AUDIT_SECONDS = 60

// the interval at which the service audits the entire local calendar
const CALENDAR_FULL_AUDIT_SECONDS = 1800

// the interval at which the service calculates the Core challenge solution
const SOLVE_CHALLENGE_INTERVAL_MS = 1000 * 60 * 30 // 30 minutes

// pull in variables defined in shared CalendarBlock module
let sequelizeCalBlock = calendarBlock.sequelize
let sequelizePubKey = publicKey.sequelize

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
  let publicScheme = env.CHAINPOINT_NODE_PUBLIC_SCHEME || null
  let publicAddr = env.CHAINPOINT_NODE_PUBLIC_ADDR || null
  let nodePort = env.CHAINPOINT_NODE_PORT || null
  if (!publicScheme || !publicAddr) {
    // values were not provided for both public variables, no public access
    return null
  }
  // ensure the proper protocol is in use
  if (['http', 'https'].indexOf(publicScheme.toLowerCase()) === -1) throw new Error('Invalid CHAINPOINT_NODE_PUBLIC_SCHEME')
  // ensure, if hostname is an IP, that it is not a private IP
  if (ip.isV4Format(publicAddr)) {
    if (ip.isPrivate(publicAddr)) throw new Error('Invalid CHAINPOINT_NODE_PUBLIC_ADDR')
  }
  // disallow localhost
  if (publicAddr === 'localhost') throw new Error('Invalid CHAINPOINT_NODE_PUBLIC_ADDR')
  try {
    nodePort = parseInt(nodePort)
  } catch (error) {
    throw new Error('Invalid CHAINPOINT_NODE_PORT')
  }
  if (nodePort < 1 || nodePort > 65535) throw new Error('Invalid CHAINPOINT_NODE_PORT')

  let publicUri = `${publicScheme}://${publicAddr}:${nodePort}`
  return publicUri
}

// establish a connection with the database
async function openStorageConnectionAsync () {
  let storageConnected = false
  while (!storageConnected) {
    try {
      await sequelizeCalBlock.sync({ logging: false })
      await sequelizePubKey.sync({ logging: false })
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
      // Ensure that the target directory exists
      if (!fs.existsSync(untildify(HMACKEY_DIR))) {
        fs.mkdirSync(untildify(HMACKEY_DIR))
      }
      let pathToKeyFile = untildify(`${HMACKEY_DIR}/${HMACKEY_FILENAME}`)
      // Ensure that the target file exists
      if (fs.existsSync(pathToKeyFile)) {
        console.log('keyfile found')
        // the file exists, so read the key and PUT Node info with HMAC to Core
        let hmacKey = utils.readFile(pathToKeyFile)
        let hash = crypto.createHmac('sha256', hmacKey)
        let dateString = moment().utc().format('YYYYMMDDHHmm')
        let hmacTxt = [env.NODE_TNT_ADDRESS, publicUri, dateString].join('')
        let calculatedHMAC = hash.update(hmacTxt).digest('hex')

        let putObject = {
          tnt_addr: env.NODE_TNT_ADDRESS,
          public_uri: publicUri || undefined,
          hmac: calculatedHMAC
        }

        let putOptions = {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'PUT',
          uri: `/nodes/${env.NODE_TNT_ADDRESS}`,
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
        console.log('Node registered : key found : hmac computed and sent')

        return hmacKey
      } else {
        console.log('keyfile not found')
        // the file doesnt exist, so POST Node info to Core and store resulting HMAC key
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

          utils.writeFile(pathToKeyFile, response.hmac_key)
          console.log('Node registered : hmac key not found : new key received and saved to ~/.chainpoint/node-hmac.key')

          return response.hmac_key
        } catch (error) {
          if (error.statusCode === 409) {
            // the TNT address is already in use with an existing hmac key
            // if the hmac key was lost, you need to re-register with a new
            // TNT address and receive a new hmac key
            console.error('NODE_TNT_ADDRESS already in use with existing HMAC key')
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
    console.log(`${apiServer.api.name} listening on port ${env.CHAINPOINT_NODE_PORT}`)
    return callback(null)
  })
}
// make awaitable async version for startListening function
let startListeningAsync = promisify(startListening)

// synchronize local calendar with global calendar, retreive all missing blocks
async function syncCalendarAsync (coreConfig, pubKeys) {
  // pull down global calendar until local calendar is in sync, startup = true
  await calendar.syncCalendarAsync(true, coreConfig, pubKeys)
}

// start all functions meant to run on a periodic basis
function startIntervals (coreConfig) {
  // start the interval process for keeping the calendar data up to date
  calendar.startPeriodicUpdateAsync(coreConfig, CALENDAR_UPDATE_SECONDS * 1000)
  // start the interval processes for auditing local calendar data
  calendar.startAuditLocalRecentAsync(CALENDAR_RECENT_AUDIT_SECONDS * 1000)
  calendar.startAuditLocalFullAsync(CALENDAR_FULL_AUDIT_SECONDS * 1000)
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
    apiServer.setHmacKey(hmacKey)
    let coreConfig = await coreHosts.getCoreConfigAsync()
    let pubKeys = await initPublicKeysAsync(coreConfig)
    await startListeningAsync()
    await syncCalendarAsync(coreConfig, pubKeys)
    startIntervals(coreConfig)
    console.log('startup completed successfully')
  } catch (err) {
    console.error(`An error has occurred on startup: ${err}`)
    process.exit(1)
  }
}

// get the whole show started
startAsync()
