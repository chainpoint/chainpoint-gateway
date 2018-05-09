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

const path = require('path')
const restify = require('restify')
const errors = require('restify-errors')
const corsMiddleware = require('restify-cors-middleware')
const firewall = require('webfirewall')
const rp = require('request-promise-native')
const fs = require('fs')
const _ = require('lodash')
const validator = require('validator')

const apiHashes = require('./endpoints/hashes.js')
const apiProofs = require('./endpoints/proofs.js')
const apiCalendar = require('./endpoints/calendar.js')
const apiVerify = require('./endpoints/verify.js')
const apiConfig = require('./endpoints/config.js')
const apiStats = require('./endpoints/stats.js')

// state indicating if the Node is ready to accept new hashes for processing
let acceptingHashes = true

let server = null
let registrationPassed = false

// middleware to ensure the Node is accepting hashes
function ensureAcceptingHashes (req, res, next) {
  if (!acceptingHashes || !registrationPassed) {
    return next(new errors.ServiceUnavailableError('Service is not currently accepting hashes'))
  }
  return next()
}

function extractTorExitIPs (resp) {
  let exitNodes = []

  if (!_.isString(resp)) { return exitNodes }

  let respArr = resp.split('\n')
  if (!_.isArray(respArr)) { return exitNodes }

  _.forEach(respArr, (value) => {
    if (/^ExitAddress/.test(value)) {
      // The second segment of the ExitAddress line is the IP
      let ip = value.split(' ')[1]

      // Confirm its an IPv4 address
      if (validator.isIP(ip, 4)) {
        exitNodes.push(ip)
      }
    }
  })

  return exitNodes
}

async function initLocalIPBlacklistAsync () {
  try {
    if (fs.existsSync('./ip-blacklist.txt')) {
      let blacklist = fs.readFileSync('./ip-blacklist.txt', 'utf-8')
      let splitBlacklist = blacklist.split('\n')
      let compactBlacklist = _.compact(splitBlacklist)
      let uniqBlacklist = _.uniq(compactBlacklist)

      let ipList = []
      _.forEach(uniqBlacklist, (ip) => {
        // any line that doesn't start with '#' comment
        if (/^[^#]/.test(ip)) {
          // Confirm its an IPv4 or IPv6 address
          // IPv6 allowed is to handle the macOS/Docker
          // situation where the IP is like: ::ffff:172.18.0.1
          // See : https://stackoverflow.com/a/33790357/3902629
          if (validator.isIP(ip)) {
            ipList.push(ip)
          }
        }
      })

      // console.log(`INFO : Firewall : ${ipList.length} Local IPs`)
      return ipList
    } else {
      return []
    }
  } catch (error) {
    console.log(`WARN : Firewall : No Local IPs`)
    return []
  }
}

async function initCoreIPBlacklistAsync () {
  try {
    let host = _.shuffle([
      'https://a.chainpoint.org/nodes/blacklist',
      'https://b.chainpoint.org/nodes/blacklist',
      'https://c.chainpoint.org/nodes/blacklist'])

    let response = await rp({
      method: 'GET',
      uri: host[0],
      json: true,
      gzip: true
    })

    if (!_.has(response, 'blacklist')) { return [] }
    if (!_.isArray(response.blacklist)) { return [] }

    // filter out any non-ip addresses that might have crept in
    let filteredBlacklist = _.filter(response.blacklist, (ip) => { return validator.isIP(ip) })
    // console.log(`INFO : Firewall : ${filteredBlacklist.length} Core IPs`)
    return filteredBlacklist
  } catch (error) {
    console.error('WARN : Firewall : Unable to load Core IP list')
    return []
  }
}

async function initTorExitIPAsync () {
  try {
    let response = await rp({
      method: 'GET',
      uri: 'https://check.torproject.org/exit-addresses',
      gzip: true,
      timeout: 10000
    })

    let extractedTorExitNodes = extractTorExitIPs(response)
    // console.log(`INFO : Firewall : ${extractedTorExitNodes.length} Tor IPs`)

    return extractedTorExitNodes
  } catch (error) {
    try {
      let ten = fs.readFileSync('./tor-exit-nodes.txt', 'utf-8')
      let torExitNodes = ten.split('\n')
      let compactTorExitNodes = _.compact(torExitNodes)
      let uniqTorExitNodes = _.uniq(compactTorExitNodes)

      // console.log(`INFO : Firewall : ${uniqTorExitNodes.length} Tor IPs (cache)`)
      return uniqTorExitNodes
    } catch (error) {
      console.error('ERROR : Firewall : Unable to load Tor Exit Nodes list (cache)')
      return []
    }
  }
}

async function initIPBlacklistAsync () {
  let tenIPs = await initTorExitIPAsync()
  let localIPBlacklist = await initLocalIPBlacklistAsync()
  let coreIPBlacklist = await initCoreIPBlacklistAsync()
  let mergedIPList = tenIPs.concat(localIPBlacklist).concat(coreIPBlacklist)
  // console.log(`INFO : Firewall : Added ${mergedIPList.length} external IPs to block list`)
  return _.uniq(mergedIPList)
}

async function startRestifyServerAsync (mergedIPList) {
  return new Promise(async (resolve, reject) => {
    try {
      if (server) {
        server.close(async () => {
          await restifyConfigureAndListenAsync(mergedIPList)
          return resolve()
        })
      } else {
        await restifyConfigureAndListenAsync(mergedIPList)
        return resolve()
      }
    } catch (error) {
      return reject(error)
    }
  })
}

async function restifyConfigureAndListenAsync (mergedIPList) {
  // RESTIFY SETUP
  // 'version' : all routes will default to this version
  server = restify.createServer({
    name: 'chainpoint-node',
    version: '1.0.0',
    formatters: {
      'application/json': restify.formatters['application/json; q=0.4'],
      'application/javascript': restify.formatters['application/json; q=0.4'],
      'text/html': restify.formatters['application/json; q=0.4'],
      'application/octet-stream': restify.formatters['application/json; q=0.4']
    }
  })

  // Uncomment to log remote IP addresses for testing.
  // server.on('connection', function (sock) {
  //   console.log('sock.remoteAddress : ', sock.remoteAddress)
  // })

  // limit responses to only requests for acceptable types
  server.pre(restify.plugins.acceptParser([
    'application/json',
    'application/javascript',
    'text/html',
    'application/octet-stream',
    'application/vnd.chainpoint.ld+json',
    'application/vnd.chainpoint.json+base64']))

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
  server.use(restify.plugins.queryParser({ mapParams: true }))
  server.use(restify.plugins.bodyParser({ mapParams: true }))

  // DROP all requests from blacklisted IP addresses
  server.use(firewall({
    populationStrategy: 'restify',
    defaultAction: 'ACCEPT',
    rules: [
      {
        methods: ['GET'],
        paths: ['*'],
        ipAddresses: mergedIPList,
        action: 'DROP'
      }
    ]
  }))

  // API RESOURCES
  // IMPORTANT : These routes MUST come after the firewall initialization!

  // submit hash(es)
  server.post({ path: '/hashes', version: '1.0.0' }, ensureAcceptingHashes, apiHashes.postHashesV1Async)
  // get a single proof with a single hash_id
  server.get({ path: '/proofs/:hash_id_node', version: '1.0.0' }, apiProofs.getProofsByIDV1Async)
  // get multiple proofs with 'hashids' header param
  server.get({ path: '/proofs', version: '1.0.0' }, apiProofs.getProofsByIDV1Async)
  // verify one or more proofs
  server.post({ path: '/verify', version: '1.0.0' }, apiVerify.postProofsForVerificationV1Async)
  // get the block object for the calendar at the specified height
  server.get({ path: '/calendar/:height', version: '1.0.0' }, apiCalendar.getCalBlockByHeightV1Async)
  // get the block hash for the calendar at the specified height
  server.get({ path: '/calendar/:height/hash', version: '1.0.0' }, apiCalendar.getCalBlockHashByHeightV1Async)
  // get the block data value for the calendar at the specified height
  server.get({ path: '/calendar/:height/data', version: '1.0.0' }, apiCalendar.getCalBlockDataByHeightV1Async)
  // get configuration information for this Node
  server.get({ path: '/config', version: '1.0.0' }, apiConfig.getConfigInfoV1Async)

  server.get({ path: '/stats', version: '1.0.0' }, apiStats.getNodeStatsV1Async)

  server.get({ path: '/login', version: '1.0.0' }, function (req, res, next) {
    res.redirect('/', next)
  })

  server.get({ path: '/about', version: '1.0.0' }, function (req, res, next) {
    res.redirect('/', next)
  })

  server.get({ path: /\/?.*/, version: '1.0.0' }, restify.plugins.serveStatic({
    directory: path.resolve(__dirname, '../ui'),
    default: 'index.html'
  }))

  // instruct restify to begin listening for requests
  return new Promise((resolve, reject) => {
    server.listen(8080, (err) => {
      if (err) return reject(err)
      return resolve()
    })
  })
}

async function startAsync () {
  try {
    let mergedIPList = await initIPBlacklistAsync()
    await startRestifyServerAsync(mergedIPList)
  } catch (error) {
    console.error(`ERROR : Startup : ${error.message}`)
  }
}

async function restartRestifyAsync () {
  console.log(`INFO : App : Restarting API server`)
  try {
    let mergedIPList = await initIPBlacklistAsync()
    acceptingHashes = false
    await startRestifyServerAsync(mergedIPList)
  } catch (error) {
    console.error(`ERROR : Restart : ${error.message}`)
  }
  acceptingHashes = true
}

module.exports = {
  setRedis: (redisClient) => {
    apiHashes.setRedis(redisClient)
    apiProofs.setRedis(redisClient)
    apiConfig.setRedis(redisClient)
    apiVerify.setRedis(redisClient)
    apiCalendar.setRedis(redisClient)
    apiStats.setRedis(redisClient)
  },
  setHmacKey: (hmacKey) => {
    apiHashes.setHmacKey(hmacKey)
  },
  setRegistration: (status) => {
    registrationPassed = status
    apiStats.setRegistration(status)
  },
  startAggInterval: () => {
    apiHashes.startAggInterval()
  },
  setPublicKeySet: (pubKeys) => {
    apiVerify.setPublicKeySet(pubKeys)
    apiConfig.setPublicKeySet(pubKeys)
  },
  restartRestifyAsync: restartRestifyAsync,
  startAsync: startAsync
}
