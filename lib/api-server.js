const restify = require('restify')
const corsMiddleware = require('restify-cors-middleware')
const apiRoot = require('./endpoints/root.js')
const apiHello = require('./endpoints/hello.js')

// state indicating if the local calendar is fully synched to the global calendar
let calendarInSync = false

// middleware to ensure the calendar is in sync before processing API requests
function ensureInSync (req, res, next) {
  if (!calendarInSync) {
    return next(new restify.ServiceUnavailableError('Service is currently syncing calendar data.'))
  }
  return next()
}

// RESTIFY SETUP
// 'version' : all routes will default to this version
let server = restify.createServer({
  name: 'chainpoint-node',
  version: '1.0.0'
})

// Clean up sloppy paths like //todo//////1//
server.pre(restify.pre.sanitizePath())

// Checks whether the user agent is curl. If it is, it sets the
// Connection header to "close" and removes the "Content-Length" header
// See : http://restify.com/#server-api
server.pre(restify.pre.userAgentConnection())

let cors = corsMiddleware({
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
server.get({ path: '/hello', version: '1.0.0' }, ensureInSync, apiHello.getV1)
// teapot
server.get({ path: '/', version: '1.0.0' }, apiRoot.getV1)

module.exports = {
  api: server,
  setCalendarInSync: (inSync) => { calendarInSync = inSync }
}
