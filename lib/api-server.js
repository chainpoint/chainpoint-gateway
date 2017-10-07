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
const apiRoot = require('./endpoints/root.js')
const apiHashes = require('./endpoints/hashes.js')
const apiProofs = require('./endpoints/proofs.js')
const apiCalendar = require('./endpoints/calendar.js')
const apiVerify = require('./endpoints/verify.js')
const apiConfig = require('./endpoints/config.js')

// state indicating if the Node calendar is fully synched to the Core calendar
let calendarInSync = false

// middleware to ensure the calendar is in sync before processing API requests

function ensureInSync (req, res, next) {
  if (!calendarInSync) {
    return next(new errors.ServiceUnavailableError('Service is currently syncing calendar data from Core.'))
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

server.use(restify.plugins.gzipResponse())
server.use(restify.plugins.queryParser({ mapParams: true }))
server.use(restify.plugins.bodyParser({ mapParams: true }))

// API RESOURCES

// submit hash(es)
server.post({ path: '/hashes', version: '1.0.0' }, ensureInSync, apiHashes.postHashesV1)
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
  setCalendarInSync: (inSync) => { calendarInSync = inSync }
}
