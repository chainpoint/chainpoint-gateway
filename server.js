// load environment variables
const env = require('./lib/parse-env.js')

const { promisify } = require('util')
const apiServer = require('./lib/api-server.js')
const calendarBlock = require('./lib/models/CalendarBlock.js')
const utils = require('./lib/utils.js')
const calendar = require('./lib/calendar.js')
const r = require('redis')

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
    await utils.sleep(5000)
    openRedisConnection(redisURI)
  })
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
    await openStorageConnectionAsync()
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
