// load environment variables
const env = require('./lib/parse-env.js')

const { promisify } = require('util')
const apiServer = require('./lib/api-server.js')
const calendarBlock = require('./lib/models/CalendarBlock.js')
const utils = require('./lib/utils.js')
const calendar = require('./lib/calendar.js')
const r = require('redis')
const fs = require('fs')
const untildify = require('untildify')
const crypto = require('crypto')
const rp = require('request-promise-native')
const moment = require('moment')
const url = require('url')
const ip = require('ip')

const HMACKEY_DIR = '/home/node/app/.chainpoint'
const HMACKEY_FILENAME = 'node-hmac.key'

// the interval at which the service queries the calendar for new blocks
const CALENDAR_UPDATE_SECONDS = 15

// the interval at which the service audits the entire local calendar
const CALENDAR_RECENT_AUDIT_SECONDS = 60

// the interval at which the service audits the entire local calendar
const CALENDAR_FULL_AUDIT_SECONDS = 1800

// pull in variables defined in shared CalendarBlock module
let sequelize = calendarBlock.sequelize

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

// Opens a Redis connection
function openRedisConnection (redisURI) {
  redis = r.createClient(redisURI)
  redis.on('ready', () => {
    apiServer.setRedis(redis)
    console.log('Redis connection established')
  })
  redis.on('error', async () => {
    redis.quit()
    redis = null
    apiServer.setRedis(null)
    console.error('Cannot establish Redis connection. Attempting in 5 seconds...')
    await utils.sleepAsync(5000)
    openRedisConnection(redisURI)
  })
}

// ensure that the public Uri provided is a valid public ip if an ip is supplied
async function validatePublicUri () {
  let publicUri = env.NODE_PUBLIC_URI || null
  if (!publicUri) return // no value was provided, nothing to check
  let parsedPublicUri = url.parse(publicUri)
  // ensure the prorer protocal is in use
  if (['http', 'https'].indexOf(parsedPublicUri.protocol.toLowerCase()) === -1) throw new Error('Invalid NODE_PUBLIC_URI')
  // ensure, if hostname is an IP, that it is not a private IP
  if (ip.isV4Format(publicUri.hostname)) {
    if (ip.isPrivate(publicUri.hostname)) throw new Error('Invalid NODE_PUBLIC_URI')
  }
}

// establish a connection with the database
async function openStorageConnectionAsync () {
  let storageConnected = false
  while (!storageConnected) {
    try {
      await sequelize.sync({ logging: false })
      storageConnected = true
      console.log('CalendarBlock sequelize database synchronized')
    } catch (error) {
      console.error('Cannot establish Postgres connection. Attempting in 5 seconds...')
      await utils.sleepAsync(5000)
    }
  }
}

async function registerNode () {
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
        let hmacTxt = [env.NODE_TNT_ADDRESS, env.NODE_PUBLIC_URI || null, dateString].join('')
        let calculatedHMAC = hash.update(hmacTxt).digest('hex')

        let putObject = {
          tnt_addr: env.NODE_TNT_ADDRESS,
          public_uri: env.NODE_PUBLIC_URI || undefined,
          hmac: calculatedHMAC
        }

        let putOptions = {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'PUT',
          uri: `${env.CHAINPOINT_CORE_API_BASE_URI}/nodes/${env.NODE_TNT_ADDRESS}`,
          body: putObject,
          json: true,
          gzip: true,
          resolveWithFullResponse: true
        }

        let response = await rp(putOptions)
        if (response.statusCode !== 200) throw new Error('Invalid response')
        isRegistered = true
        console.log('Node registered : key found : hmac computed and sent')
      } else {
        console.log('keyfile not found')
        // the file doesnt exist, so POST Node info to Core and store resulting HMAC key
        let postObject = {
          tnt_addr: env.NODE_TNT_ADDRESS,
          public_uri: env.NODE_PUBLIC_URI || undefined
        }

        let postOptions = {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST',
          uri: `${env.CHAINPOINT_CORE_API_BASE_URI}/nodes`,
          body: postObject,
          json: true,
          gzip: true,
          resolveWithFullResponse: true
        }

        try {
          let response = await rp(postOptions)
          isRegistered = true

          utils.writeFile(pathToKeyFile, response.body.hmac_key)
          console.log('Node registered : key not found : hmac key received and stored')
        } catch (error) {
          if (error.statusCode === 409) {
          // the TNT address is already in use with an existing hmac key
          // if the hmac key was lost, you need to re-register with a new
          // TNT address and receive a new hmac key
            console.error('NODE_TNT_ADDRESS already in use with existing HMAC key')
            process.exit(1)
          }
          throw new Error('Invalid response')
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
// instruct restify to begin listening for requests
function startListening (callback) {
  apiServer.api.listen(8080, (err) => {
    if (err) return callback(err)
    console.log(`${apiServer.api.name} listening at ${apiServer.api.url}`)
    return callback(null)
  })
}
// make awaitable async version for startListening function
let startListeningAsync = promisify(startListening)

// synchronize local calendar with global calendar, retreive all missing blocks
async function syncCalendarAsync () {
  // get the stack config to determine caklendar block query max per request
  let stackConfig = await utils.getStackConfigAsync(env.CHAINPOINT_CORE_API_BASE_URI)
  // pull down global calendar until local calendar is in sync, startup = true
  await calendar.syncCalendarAsync(true, stackConfig)
  // mark the calendar as in sync, so the API and other functions know it is ready
  // apiServer.setCalendarInSync(true)
  // return the stackConfig for use in update process
  return stackConfig
}

// start all functions meant to run on a periodic basis
function startIntervals (stackConfig) {
  // start the interval process for keeping the calendar data up to date
  calendar.startPeriodicUpdateAsync(stackConfig, CALENDAR_UPDATE_SECONDS * 1000)
  // start the interval processes for auditing local calendar data
  calendar.startAuditLocalRecentAsync(CALENDAR_RECENT_AUDIT_SECONDS * 1000)
  calendar.startAuditLocalFullAsync(CALENDAR_FULL_AUDIT_SECONDS * 1000)
}

// process all steps need to start the application
async function startAsync () {
  try {
    openRedisConnection(env.REDIS_CONNECT_URI)
    console.log(`Configured target Core: ${env.CHAINPOINT_CORE_API_BASE_URI}`)
    await validatePublicUri()
    await openStorageConnectionAsync()
    await registerNode()
    await startListeningAsync()
    let stackConfig = await syncCalendarAsync()
    startIntervals(stackConfig)
    console.log('startup completed successfully')
  } catch (err) {
    console.error(`An error has occurred on startup: ${err}`)
    process.exit(1)
  }
}

// get the whole show started
startAsync()
