// load environment variables
const env = require('./lib/parse-env.js')

const { promisify } = require('util')
const apiServer = require('./lib/api-server.js')
const calendarBlock = require('./lib/models/CalendarBlock.js')
const utils = require('./lib/utils.js')
const calendar = require('./lib/calendar.js')

// pull in variables defined in shared CalendarBlock module
let sequelize = calendarBlock.sequelize
let CalendarBlock = calendarBlock.CalendarBlock

// state indicating if the local calendar is fully synched to the global calendar
let calendarInSync = false

// establish a connection with the database
async function openStorageConnectionAsync () {
  let storageConnected = false
  while (!storageConnected) {
    try {
      await sequelize.sync({ logging: false }).then(() => {
        storageConnected = true
        console.log('CalendarBlock sequelize database synchronized')
      })
    } catch (error) {
      console.error('Cannot establish Postgres connection. Attempting in 5 seconds...')
      await utils.sleep(5000)
    }
  }
}

// instruct restify to begin listening for requests
function startListening (callback) {
  apiServer.listen(8080, (err) => {
    if (err) return callback(err)
    console.log(`${apiServer.name} listening at ${apiServer.url}`)
    return callback(null)
  })
}
// make awaitable async version for startListening function
let startListeningAsync = promisify(startListening)

// synchronize local calendar with global calendar, retreive all missing blocks
async function syncCalendarAsync () {
  // get the stack config to determine caklendar block query max per request
  let stackConfig = await utils.getStackConfig(env.CHAINPOINT_API_BASE_URI)
  // pull down globall calendar until local calendar is in sync
  await calendar.sync(stackConfig)
  // mark the calendar as in sync, so the API and other functions know it is ready
  calendarInSync = true
}

// process all steps need to start the application
async function start () {
  try {
    await openStorageConnectionAsync()
    await startListeningAsync()
    await syncCalendarAsync()
    console.log('startup completed successfully')
  } catch (err) {
    console.error(`An error has occurred on startup: ${err}`)
    process.exit(1)
  }
}

// get the whole show started
start()
