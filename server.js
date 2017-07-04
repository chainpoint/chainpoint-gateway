const restify = require('restify')
const corsMiddleware = require('restify-cors-middleware')
const apiRoot = require('./endpoints/root.js')
const apiHello = require('./endpoints/hello.js')

// Frequency to perform the action in milliseconds
const INTERVAL = 2000

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

// first fire up restify and then begin background function
function start () {
  // SERVER
  server.listen(8080, () => {
    console.log('%s listening at %s', server.name, server.url)
    // Start the interval function
    setInterval(() => {
      console.log(`Interval reached at ${new Date().toISOString()}`)
    }, INTERVAL)
  })
}

// start the whole show here
start()
