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

const restify = require('restify')
const errors = require('restify-errors')
const corsMiddleware = require('restify-cors-middleware')
const firewall = require('webfirewall')
const rp = require('request-promise-native')
const fs = require('fs')
const _ = require('lodash')
const validator = require('validator')

const { version } = require('../package.json')

const apiRoot = require('./endpoints/root.js')
const apiHashes = require('./endpoints/hashes.js')
const apiProofs = require('./endpoints/proofs.js')
const apiCalendar = require('./endpoints/calendar.js')
const apiVerify = require('./endpoints/verify.js')
const apiConfig = require('./endpoints/config.js')

// state indicating if the Node calendar is fully synched to the Core calendar
let calendarInSync = false

// state indicating if the Node is ready to accept new hashes for processing
let acceptingHashes = true

// middleware to ensure the calendar is in sync before processing API requests

function ensureInSync (req, res, next) {
  if (!calendarInSync) {
    return next(new errors.ServiceUnavailableError('Service is currently syncing calendar data from Core'))
  }
  return next()
}

// middleware to ensure the Node is accepting hashes

function ensureAcceptingHashes (req, res, next) {
  if (!acceptingHashes) {
    return next(new errors.ServiceUnavailableError('Service is not currently accepting hashes'))
  }
  return next()
}

// RESTIFY SETUP
// 'version' : all routes will default to this version
let server = restify.createServer({
  name: 'chainpoint-node',
  version: '1.0.0'
})

// Uncomment to log remote IP addresses for testing.
// server.on('connection', function (sock) {
//   console.log('sock.remoteAddress : ', sock.remoteAddress)
// })

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

server.use(restify.plugins.gzipResponse())
server.use(restify.plugins.queryParser({ mapParams: true }))
server.use(restify.plugins.bodyParser({ mapParams: true }))

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
      gzip: true
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
  console.log(`INFO : Firewall : ${mergedIPList.length} IPs blocked`)
  return _.uniq(mergedIPList)
}

async function startAsync () {
  console.log(`INFO : App : Version : ${version}`)
  let mergedIPList = await initIPBlacklistAsync()

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
  server.post({ path: '/hashes', version: '1.0.0' }, ensureInSync, ensureAcceptingHashes, apiHashes.postHashesV1)
  // get a single proof with a single hash_id
  server.get({ path: '/proofs/:hash_id_node', version: '1.0.0' }, ensureInSync, apiProofs.getProofsByIDV1Async)
  // get multiple proofs with 'hashids' header param
  server.get({ path: '/proofs', version: '1.0.0' }, ensureInSync, apiProofs.getProofsByIDV1Async)
  // verify one or more proofs
  server.post({ path: '/verify', version: '1.0.0' }, ensureInSync, apiVerify.postProofsForVerificationV1Async)
  // get the block object for the calendar at the specified height
  server.get({ path: '/calendar/:height', version: '1.0.0' }, ensureInSync, apiCalendar.getCalBlockByHeightV1Async)
  // get configuration information for this Node
  server.get({ path: '/config', version: '1.0.0' }, apiConfig.getConfigInfoV1Async)
  // teapot
  server.get({ path: '/', version: '1.0.0' }, ensureInSync, apiRoot.getV1)
}

// start the api server
startAsync()

module.exports = {
  api: server,
  setRedis: (redisClient) => {
    apiHashes.setRedis(redisClient)
    apiProofs.setRedis(redisClient)
    apiConfig.setRedis(redisClient)
    apiVerify.setRedis(redisClient)
  },
  setHmacKey: (hmacKey) => {
    apiHashes.setHmacKey(hmacKey)
  },
  setCalendarInSync: (inSync) => { calendarInSync = inSync },
  setAcceptingHashes: (isAccepting) => { acceptingHashes = isAccepting },
  getHashDataCount: () => { return apiHashes.getHashDataCount() }
}
