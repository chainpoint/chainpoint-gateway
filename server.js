const { promisify } = require('util')
const apiServer = require('./lib/api-server.js')
const calendarBlock = require('./lib/models/CalendarBlock.js')

// pull in variables defined in shared CalendarBlock module
let sequelize = calendarBlock.sequelize
let CalendarBlock = calendarBlock.CalendarBlock

// await a specified number of milliseconds to elapse
function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
      await timeout(5000)
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

// process all steps need to start the application
async function start () {
  try {
    await openStorageConnectionAsync()
    await startListeningAsync()
    console.log('startup completed successfully')
  } catch (err) {
    console.error(`An error has occurred on startup: ${err}`)
    process.exit(1)
  }
}

// get the whole show started
start()
