/**
 * Copyright 2019 Tierion
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

const restify = require('restify')
const errors = require('restify-errors')
const corsMiddleware = require('restify-cors-middleware')
let rp = require('request-promise-native')
let fs = require('fs')
const _ = require('lodash')
const validator = require('validator')
let rocksDB = require('./models/RocksDB.js')
const logger = require('./logger.js')
const env = require('../lib/parse-env.js').env

const { version } = require('../package.json')
const apiHashes = require('./endpoints/hashes.js')
const apiCalendar = require('./endpoints/calendar.js')
const apiProofs = require('./endpoints/proofs.js')
const apiVerify = require('./endpoints/verify.js')
const apiConfig = require('./endpoints/config.js')

// RESTIFY SETUP
// 'version' : all routes will default to this version
const httpOptions = {
  name: 'chainpoint-node',
  version: '2.0.0',
  formatters: {
    'application/json': restify.formatters['application/json; q=0.4'],
    'application/javascript': restify.formatters['application/json; q=0.4'],
    'text/html': restify.formatters['application/json; q=0.4'],
    'application/octet-stream': restify.formatters['application/json; q=0.4']
  }
}

const TOR_IPS_KEY = 'blacklist:tor:ips'

// state indicating if the Node is ready to accept new hashes for processing
let acceptingHashes = true

let registrationPassed = true

// the list of IP to refuse connections from
let IPBlacklist = []

// middleware to ensure the Node is accepting hashes
function ensureAcceptingHashes(req, res, next) {
  if (!acceptingHashes || !registrationPassed) {
    return next(new errors.ServiceUnavailableError('Service is not currently accepting hashes'))
  }
  return next()
}

async function refreshIPBlacklistAsync() {
  let torExitIPs = await getTorExitIPAsync()
  let localIPBlacklist = await getLocalIPBlacklistAsync()
  let mergedIPBlacklist = torExitIPs.concat(localIPBlacklist)
  return _.uniq(mergedIPBlacklist)
}

async function getTorExitIPAsync() {
  let options = {
    headers: {
      'User-Agent': `chainpoint-node/${version}`
    },
    method: 'GET',
    uri: 'https://check.torproject.org/exit-addresses',
    gzip: true,
    timeout: 10000
  }

  // Retrieve latest exit IP list
  let extractedTorExitIPs = null
  try {
    let response = await rp(options)
    extractedTorExitIPs = parseTorExitIPs(response)
  } catch (error) {
    logger.error('Firewall : Unable to refresh Tor exit IP list from check.torproject.org')
  }

  // Save IPs to cache and return if retrieval succeeded
  if (extractedTorExitIPs !== null) {
    let compactTorExitIPs = _.compact(extractedTorExitIPs)
    let uniqueTorExitIPs = _.uniq(compactTorExitIPs)
    try {
      await rocksDB.setAsync(TOR_IPS_KEY, uniqueTorExitIPs)
    } catch (error) {
      logger.error('Firewall : Unable to save Tor exit IP list to cache')
    }
    return uniqueTorExitIPs
  } else {
    // otherwise, read existing from cache and return
    try {
      let cachedTorExitIPs = await rocksDB.getAsync(TOR_IPS_KEY)
      return cachedTorExitIPs.split(',')
    } catch (error) {
      logger.error('Firewall : Unable to load Tor exit IP list from cache')
      return []
    }
  }
}

function parseTorExitIPs(response) {
  let exitIPs = []

  if (!_.isString(response)) {
    return exitIPs
  }

  let respArr = response.split('\n')
  if (!_.isArray(respArr)) {
    return exitIPs
  }

  _.forEach(respArr, value => {
    if (/^ExitAddress/.test(value)) {
      // The second segment of the ExitAddress line is the IP
      let ip = value.split(' ')[1]

      // Confirm its an IPv4 address
      if (validator.isIP(ip.toString(), 4)) {
        exitIPs.push(ip)
      }
    }
  })

  return exitIPs
}

async function getLocalIPBlacklistAsync() {
  try {
    if (fs.existsSync('./ip-blacklist.txt')) {
      let blacklist = fs.readFileSync('./ip-blacklist.txt', 'utf-8')
      let splitBlacklist = blacklist.split('\n')
      let compactBlacklist = _.compact(splitBlacklist)
      let uniqBlacklist = _.uniq(compactBlacklist)

      let ipList = []
      _.forEach(uniqBlacklist, ip => {
        // any line that doesn't start with '#' comment
        if (/^[^#]/.test(ip)) {
          // Confirm its an IPv4 or IPv6 address
          // IPv6 allowed is to handle the macOS/Docker
          // situation where the IP is like: ::ffff:172.18.0.1
          // See : https://stackoverflow.com/a/33790357/3902629
          if (validator.isIP(ip.toString())) {
            ipList.push(ip)
          }
        }
      })

      return ipList
    } else {
      return []
    }
  } catch (error) {
    logger.warn('Firewall : Unable to parse local IP blacklist (ip-blacklist.txt) ')
    return []
  }
}

function ipFilter(req, res, next) {
  var reqIPs = []
  if (req.headers['x-forwarded-for']) {
    let fwdIPs = req.headers['x-forwarded-for'].split(',')
    reqIPs.push(fwdIPs[0])
  }
  reqIPs.push(req.connection.remoteAddress || '')

  reqIPs = reqIPs
    .filter(ip => validator.isIP(ip))
    .reduce((ips, ip) => {
      ips.push(ip, ip.replace(/^.*:/, ''))
      return ips
    }, [])

  for (let ip of reqIPs) {
    if (IPBlacklist.includes(ip)) return next(new errors.ForbiddenError())
  }

  return next()
}

// Put any routing, response, etc. logic here.
function setupCommonRestifyConfigAndRoutes(server) {
  // limit responses to only requests for acceptable types
  server.pre(
    restify.plugins.acceptParser([
      'application/json',
      'application/javascript',
      'text/html',
      'application/octet-stream',
      'application/vnd.chainpoint.ld+json',
      'application/vnd.chainpoint.json+base64'
    ])
  )

  // Clean up sloppy paths like //todo//////1//
  server.pre(restify.pre.sanitizePath())

  // Checks whether the user agent is curl. If it is, it sets the
  // Connection header to "close" and removes the "Content-Length" header
  // See : http://restify.com/#server-api
  server.pre(restify.pre.userAgentConnection())

  // CORS
  // See : https://github.com/TabDigital/restify-cors-middleware
  // See : https://github.com/restify/node-restify/issues/1151#issuecomment-271402858
  //
  // Test w/
  //
  // curl \
  // --verbose \
  // --request OPTIONS \
  // http://127.0.0.1:9090/hashes \
  // --header 'Origin: http://localhost:9292' \
  // --header 'Access-Control-Request-Headers: Origin, Accept, Content-Type' \
  // --header 'Access-Control-Request-Method: POST' \
  // --header 'hashids: da5b6c70-d628-11e7-a676-0102636501e0'
  //
  let cors = corsMiddleware({
    preflightMaxAge: 600,
    origins: ['*'],
    allowHeaders: ['hashids,auth'],
    exposeHeaders: ['hashids']
  })
  server.pre(cors.preflight)
  server.use(cors.actual)

  server.use(restify.plugins.gzipResponse())
  server.use(
    restify.plugins.queryParser({
      mapParams: true
    })
  )
  server.use(
    restify.plugins.bodyParser({
      mapParams: true
    })
  )

  // DROP all requests from blacklisted IP addresses
  server.use(ipFilter)

  const applyMiddleware = (middlewares = []) => {
    if (process.env.NODE_ENV === 'development' || process.env.NETWORK === 'testnet') {
      return []
    } else {
      return middlewares
    }
  }

  let throttle = (burst, rate, opts = { ip: true }) => {
    return restify.plugins.throttle(Object.assign({}, { burst, rate }, opts))
  }

  // API RESOURCES
  // IMPORTANT : These routes MUST come after the firewall initialization!

  // submit hash(es)
  server.post(
    { path: '/hashes', version: '2.0.0' },
    ...applyMiddleware([throttle(50, 25)]),
    ensureAcceptingHashes,
    apiHashes.postHashesAsync
  )
  // get a data value from a calendar transaction
  server.get(
    { path: '/calendar/:tx_id/data', version: '2.0.0' },
    ...applyMiddleware([throttle(15, 5)]),
    apiCalendar.getDataValueByIDAsync
  )
  // get a single proof with a single hash_id
  server.get(
    { path: '/proofs/:proof_id', version: '2.0.0' },
    ...applyMiddleware([throttle(15, 5)]),
    apiProofs.getProofsByIDAsync
  )
  // get multiple proofs with 'hashids' header param
  server.get({ path: '/proofs', version: '2.0.0' }, ...applyMiddleware([throttle(15, 5)]), apiProofs.getProofsByIDAsync)
  // verify one or more proofs
  server.post(
    { path: '/verify', version: '2.0.0' },
    ...applyMiddleware([throttle(15, 5)]),
    apiVerify.postProofsForVerificationAsync
  )
  // get configuration information for this Node
  server.get({ path: '/config', version: '2.0.0' }, ...applyMiddleware([throttle(1, 1)]), apiConfig.getConfigInfoAsync)

  server.get({ path: '/login', version: '2.0.0' }, function(req, res, next) {
    res.redirect('/', next)
  })

  server.get({ path: '/about', version: '2.0.0' }, function(req, res, next) {
    res.redirect('/', next)
  })
}

// HTTP Server
async function startInsecureRestifyServerAsync() {
  let restifyServer = restify.createServer(httpOptions)
  setupCommonRestifyConfigAndRoutes(restifyServer)

  // Begin listening for requests
  return new Promise((resolve, reject) => {
    restifyServer.listen(env.CHAINPOINT_NODE_HTTP_PORT, err => {
      if (err) return reject(err)
      logger.info(`App : Chainpoint Node listening on port ${env.CHAINPOINT_NODE_HTTP_PORT}`)
      return resolve(restifyServer)
    })
  })
}

function startIPBlacklistRefreshInterval() {
  return setInterval(async () => {
    IPBlacklist = await refreshIPBlacklistAsync()
  }, 24 * 60 * 60 * 1000) // refresh IPBlacklist every 24 hours
}

async function startAsync() {
  try {
    IPBlacklist = await refreshIPBlacklistAsync()
    await startInsecureRestifyServerAsync()
  } catch (error) {
    logger.error(`Startup : ${error.message}`)
  }
}

module.exports = {
  startAsync: startAsync,
  startInsecureRestifyServerAsync: startInsecureRestifyServerAsync,
  startIPBlacklistRefreshInterval: startIPBlacklistRefreshInterval,
  // additional functions for testing purposes
  refreshIPBlacklistAsync: refreshIPBlacklistAsync,
  setAcceptingHashes: isAccepting => {
    acceptingHashes = isAccepting
  },
  setRocksDB: db => {
    rocksDB = db
  },
  setRP: RP => {
    rp = RP
  },
  setFS: FS => {
    fs = FS
  }
}
