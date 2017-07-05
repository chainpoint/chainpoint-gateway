const restify = require('restify')
const corsMiddleware = require('restify-cors-middleware')
const apiRoot = require('./lib/endpoints/root.js')
const apiHello = require('./lib/endpoints/hello.js')
const calendarBlock = require('./lib/models/CalendarBlock.js')

// pull in variables defined in shared CalendarBlock module
let sequelize = calendarBlock.sequelize
let CalendarBlock = calendarBlock.CalendarBlock

// RESTIFY SETUP
// 'version' : all routes will default to this version
var server = restify.createServer({
  name: 'chainpoint-node',
  version: '1.0.0'
})

// Clean up sloppy paths like //todo//////1//
server.pre(restify.pre.sanitizePath())

// Checks whether the user agent is curl. If it is, it sets the
// Connection header to "close" and removes the "Content-Length" header
// See : http://restify.com/#server-api
server.pre(restify.pre.userAgentConnection())

var cors = corsMiddleware({
  preflightMaxAge: 600,
  origins: ['*']
})
server.pre(cors.preflight)
server.use(cors.actual)

server.use(restify.gzipResponse())
server.use(restify.queryParser())
server.use(restify.bodyParser())

// API RESOURCES
// get helloe message
server.get({ path: '/hello', version: '1.0.0' }, apiHello.getV1)
// teapot
server.get({ path: '/', version: '1.0.0' }, apiRoot.getV1)

// fire up restify
function startListening () {
  server.listen(8080, () => {
    console.log('%s listening at %s', server.name, server.url)
  })
}

/**
 * Opens a storage connection
 **/
function openStorageConnection (callback) {
  // Sync models to DB tables and trigger check
  // if a new genesis block is needed.
  sequelize.sync({ logging: false }).nodeify((err) => {
    if (err) {
      console.error('Cannot establish Postgres connection. Attempting in 5 seconds...')
      setTimeout(openStorageConnection.bind(null, callback), 5 * 1000)
    } else {
      console.log('CalendarBlock sequelize database synchronized')
      return callback(null, true)
    }
  })
}

function start () {
  // Open storage connection and then amqp connection
  openStorageConnection((err, result) => {
    if (err) {
      console.error(err)
    } else {
      // Init intervals and restify server
      startListening()
    }
  })
}

// get the whole show started
start()
