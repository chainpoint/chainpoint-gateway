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

const _ = require('lodash')
const validator = require('validator')

// load environment variables
const env = require('./lib/parse-env.js')

const fs = require('fs')
const os = require('os')
const { exec } = require('child_process')
const apiServer = require('./lib/api-server.js')
const calendarBlock = require('./lib/models/CalendarBlock.js')
const hmacKey = require('./lib/models/HMACKey.js')
const utils = require('./lib/utils.js')
const calendar = require('./lib/calendar.js')
const publicKeys = require('./lib/public-keys.js')
const coreHosts = require('./lib/core-hosts.js')
const crypto = require('crypto')
const moment = require('moment')
const ip = require('ip')
const bluebird = require('bluebird')
const url = require('url')
const rp = require('request-promise-native')
const { version } = require('./package.json')
const eventMetrics = require('./lib/event-metrics.js')
const rocksDB = require('./lib/models/RocksDB.js')

const r = require('redis')
bluebird.promisifyAll(r.Multi.prototype)

// the interval at which the service queries the calendar for new blocks
const CALENDAR_UPDATE_SECONDS = 300

// the interval at which the service validates recent entries in the Node calendar
const CALENDAR_VALIDATE_RECENT_SECONDS = 60

// the interval at which the service validates the entire Node calendar
const CALENDAR_VALIDATE_ALL_SECONDS = 1800

// the interval at which the service calculates the Core challenge solution
const SOLVE_CHALLENGE_INTERVAL_MS = 1000 * 60 * 30 // 30 minutes

// pull in variables defined in shared sequelize modules
let sequelizeCalBlock = calendarBlock.sequelize
let CalendarBlock = calendarBlock.CalendarBlock
let Op = sequelizeCalBlock.Op
let sequelizeHMACKey = hmacKey.sequelize
let HMACKey = hmacKey.HMACKey

let IS_PRIVATE_NODE = false

// The redis connection used for all redis communication
// This value is set once the connection has been established
let redis = null

// Opens a Redis connection
function openRedisConnection (redisURI) {
  redis = r.createClient(redisURI)

  redis.on('ready', () => {
    bluebird.promisifyAll(redis)
  })

  redis.on('error', async () => {
    redis.quit()
    redis = null
    console.error('Redis : not available. Will retry in 5 seconds...')
    await utils.sleepAsync(5000)
    openRedisConnection(redisURI)
  })
}

// Ensure that the URI provided is valid
// Returns either a valid public URI that can be registered, or null
async function validateUriAsync (nodeUri) {
  if (_.isEmpty(nodeUri)) return null

  // Valid URI with restrictions
  // Blacklisting 0.0.0.0 since its not considered a private IP
  let isValidURI = validator.isURL(nodeUri, {
    protocols: ['http', 'https'],
    require_protocol: true,
    host_blacklist: ['0.0.0.0']
  })

  let parsedURI = url.parse(nodeUri)
  let parsedURIHost = parsedURI.hostname
  let uriHasValidPort = !!((parsedURI.port === null || parsedURI.port === '80'))

  // Valid IPv4 IP address
  let uriHasValidIPHost = validator.isIP(parsedURIHost, 4)

  if (isValidURI && uriHasValidIPHost && !ip.isPrivate(parsedURIHost) && uriHasValidPort) {
    return nodeUri
  } else if (isValidURI && uriHasValidIPHost && ip.isPrivate(parsedURIHost)) {
    throw new Error(`RFC1918 Private IP Addresses like "${parsedURIHost}" cannot be specified as CHAINPOINT_NODE_PUBLIC_URI`)
  } else if (!uriHasValidPort) {
    throw new Error(`CHAINPOINT_NODE_PUBLIC_URI only supports the use of port 80`)
  } else {
    return null
  }
}

// establish a connection with the database
async function openStorageConnectionAsync () {
  let storageConnected = false
  let retryCount = 0
  while (!storageConnected) {
    try {
      await sequelizeCalBlock.sync({ logging: false })
      await sequelizeHMACKey.sync({ logging: false })
      storageConnected = true
    } catch (error) {
      if (retryCount >= 1) {
        console.error('PostgreSQL : not available : Will retry in 5 seconds...')
      }
      retryCount += 1
      await utils.sleepAsync(5000)
    }
  }
  await rocksDB.openConnectionAsync()
}

// Registering HMAC KEY from .key file
async function authKeysUpdate () {
  // Read files in current directory and filter out any file that does NOT end with a .key extension
  let keys = fs.readdirSync('./keys').filter((currVal) => {
    // We have two different naming conventions when it comes to .key files. We have to parse the filenames different based on a different string delimination
    // 1) /keys/0xabc.key which refers to a key file that contains a valid hmac key. The filename must match env.NODE_TNT_ADDRESS
    // 2) /keys/backups/0xabc-<timestamp>.key which is a backup .key file and contains a timestamp to prevent filename collisions
    let fileName = currVal.split(/\.|-/)[0]

    return (/^.*\.(key)$/).test(currVal) && _.toLower(fileName) === env.NODE_TNT_ADDRESS
  })

  if (keys.length) {
    // Iterate through all key files found and write hmac key to PostgreSQL
    for (let key of keys) {
      let isHMAC = (k) => {
        return /^[0-9a-fA-F]{64}$/i.test(k)
      }
      let keyFile = key
      let keyFileContent = fs.readFileSync(`./keys/${keyFile}`, 'utf8')
      keyFileContent = _.head(keyFileContent.split(os.EOL).map(_.trim).filter(isHMAC))

      if (isHMAC(keyFileContent)) {
        try {
          await rocksDB.saveHMACKeyAsync({ tntAddr: env.NODE_TNT_ADDRESS, hmacKey: keyFileContent, version: 1 })
          console.log(`INFO : Registration : Auth key saved to local storage : ${keyFile}`)
        } catch (err) {
          console.error(`ERROR : Registration : Error inserting/updating auth key in local storage : ${keyFile}`)
          process.exit(0)
        }
      } else {
        console.error(`ERROR : Registration : Invalid HMAC Auth Key : ${keyFile}`)
        process.exit(0)
      }
    }
  }
}

async function registerNodeAsync (nodeURI) {
  let isRegistered = false
  let registerAttempts = 1
  const maxRegisterAttempts = 3
  const retryWaitTimeMs = 5 * 1000

  while (!isRegistered) {
    try {
      // Check if HMAC key for current TNT address already exists
      let hmacEntry
      try {
        hmacEntry = await rocksDB.getHMACKeyByTNTAddressAsync(env.NODE_TNT_ADDRESS)
      } catch (error) {
        console.error(`ERROR : Registration : Unable to load auth key`)
        // We are no longer exiting this process. Simply set registration state to 'false' which
        // will allow the Node UI to be operational and thus display a failed registration state to the node operator.
        apiServer.setRegistration(false)
      }

      if (hmacEntry) {
        console.log(`INFO : Registration : Ethereum Address : ${hmacEntry.tntAddr}`)
        console.log('INFO : Registration : HMAC Key Found')
        // console.log(`INFO : Registration : Key : ${hmacEntry.hmacKey}`)
        // The HMACKey exists, so read the key and PUT Node info with HMAC to Core
        let hash = crypto.createHmac('sha256', hmacEntry.hmacKey)
        let dateString = moment().utc().format('YYYYMMDDHHmm')
        let hmacTxt = [hmacEntry.tntAddr, nodeURI, dateString].join('')
        let calculatedHMAC = hash.update(hmacTxt).digest('hex')

        let putObject = {
          tnt_addr: hmacEntry.tntAddr,
          public_uri: nodeURI,
          hmac: calculatedHMAC
        }

        let putOptions = {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'PUT',
          uri: `/nodes/${hmacEntry.tntAddr}`,
          body: putObject,
          json: true,
          gzip: true,
          resolveWithFullResponse: true
        }

        try {
          console.log('INFO : Registration : Attempting Core update using ETH/HMAC/IP')
          // Check PUT /nodes Core Request payload, if the payload equals the last payload sent to coreRequest simply skip the call
          let lastCoreRequestPayload = await rocksDB.getAsync('lastCoreRequestPayload')

          // Skip Core Request if the payload is the same as the previous one sent to PUT /nodes/:tntAddr
          if (lastCoreRequestPayload !== `${putObject.tnt_addr}|${putObject.public_uri}`) {
            await coreHosts.coreRequestAsync(putOptions)

            // PUT request to coreRequest returned a 2xx go ahead and persist put payload into Rocks
            await rocksDB.setAsync('lastCoreRequestPayload', `${putObject.tnt_addr}|${putObject.public_uri}`)
            await rocksDB.setAsync('lastCoreRequestPayloadDate', Date.now())
          }
        } catch (error) {
          if (error.statusCode === 409) {
            if (error.error && error.error.code && error.error.message) {
              console.error(`ERROR : Registration update failed : Exiting : ${nodeURI} : ${error.error.code} : ${error.error.message}`)
            } else if (error.error && error.error.code) {
              console.error(`ERROR : Registration update failed : Exiting : ${nodeURI} : ${error.error.code}`)
            } else {
              console.error(`ERROR : Registration update failed : Exiting`)
            }

            process.exit(0) // Currently, node-api-service will only throw a 409 if either of the following conditions are true: 1) etheruem address is already registered, 2) public URI is already registered
          } else if (error.statusCode === 426) {
            if (error.error && error.error.code && error.error.message) {
              console.error(`ERROR : Registration update failed : Exiting : ${nodeURI} : ${error.error.code} : ${error.error.message}`)
            } else if (error.error && error.error.code) {
              console.error(`ERROR : Registration update failed (min node version not met) : Exiting : ${nodeURI} : ${error.error.code}`)
            } else {
              console.error(`ERROR : Registration update failed (min node version not met) : Exiting`)
            }
            process.exit(0)
          }

          if (error.statusCode) {
            if (error.error && error.error.message) {
              throw new Error(`${error.statusCode} : ${error.error.message}`)
            }
            let err = { statusCode: error.statusCode }
            throw err
          }

          throw new Error(`No response received on update : ${error.message}`)
        }

        isRegistered = true
        apiServer.setRegistration(true)

        if (nodeURI) {
          console.log(`INFO : Registration : Public URI : ${nodeURI}`)
        } else {
          console.log(`INFO : Registration : Public URI : (no public URI)`)
        }

        console.log(`INFO : ***********************************`)
        console.log(`INFO : Registration : Update OK!`)
        console.log(`INFO : ***********************************`)

        return hmacEntry.hmacKey
      } else {
        // If this is the first Registration attempt we want to log to the
        // console that registration requests are starting
        if (registerAttempts === 1) {
          console.log(`INFO : Registration : HMAC Auth Key Not Found : Attempting Registration...`)
        }

        // the HMACKey doesn't exist, so POST Node info to Core and store resulting HMAC key
        let postObject = {
          tnt_addr: env.NODE_TNT_ADDRESS,
          public_uri: nodeURI
        }

        let postOptions = {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST',
          uri: `/nodes`,
          body: postObject,
          json: true,
          gzip: true,
          resolveWithFullResponse: true
        }

        try {
          let response = await coreHosts.coreRequestAsync(postOptions)
          isRegistered = true
          apiServer.setRegistration(true)

          try {
            // write new hmac entry
            let writeHMACKey = response.hmac_key
            await rocksDB.saveHMACKeyAsync({ tntAddr: env.NODE_TNT_ADDRESS, hmacKey: writeHMACKey, version: 1 })
            // read hmac entry that was just written
            let newHMACEntry = await rocksDB.getHMACKeyByTNTAddressAsync(env.NODE_TNT_ADDRESS)
            // confirm the two are the same
            if (!newHMACEntry || (newHMACEntry.hmacKey !== writeHMACKey)) {
              throw new Error(`Unable to confirm authentication key with read after write.`)
            }
          } catch (error) {
            console.error(`ERROR : Registration : HMAC Auth key write and confirm failed.`)
            // We are no longer exiting this process. Simply set registration state to 'false' which
            // will allow the Node UI to be operational and thus display a failed registration state to the node operator.
            apiServer.setRegistration(false)
          }
          console.log(`INFO : Registration : HMAC Auth key saved!`)

          console.log(`INFO : ***********************************`)
          console.log(`INFO : Registration : New Registration OK!`)
          console.log(`INFO : ***********************************`)

          // New Registration Succeeded. Perform Automatic Auth Key Backup for newly saved hmac key
          try {
            exec('node auth-keys-backup.js', (err, stdout, stderr) => {
              if (err) console.error(`ERROR : Registration : BackupAuthKeys : Unable to complete key backup(s)`)
              else console.log(stdout)
            })
          } catch (error) {
            console.log(`ERROR : Registration : AuthKeyBackup : ${error}`)
          }

          return response.hmac_key
        } catch (error) {
          if (error.statusCode === 409) {
            if (error.error && error.error.code && error.error.message) {
              console.error(`ERROR : Registration : ${nodeURI} : ${error.error.code} : ${error.error.message}`)
            } else if (error.error && error.error.code) {
              console.error(`ERROR : Registration : ${nodeURI} : ${error.error.code}`)
            } else {
              console.error(`ERROR : Registration`)
            }

            process.exit(0) // Currently, node-api-service will only throw a 409 if either of the following conditions are true: 1) etheruem address is already registered, 2) public URI is already registered
          }

          if (error.statusCode) {
            let codeInt
            try {
              codeInt = parseInt(error.statusCode)
            } catch (innerError) {
              throw new Error(`${error.statusCode}`)
            }
            if (codeInt >= 400 && codeInt <= 500 && error.error && error.error.message) {
              throw new Error(`${error.statusCode} : ${error.error.message}`)
            } else {
              throw new Error(`${error.statusCode}`)
            }
          }
          throw new Error(`no response received`)
        }
      }
    } catch (error) {
      if (error.statusCode) {
        console.error(`ERROR : Registration : Core : ${registerAttempts}/${maxRegisterAttempts} : ${error.statusCode} : Retrying...`)
      } else {
        console.error(`ERROR : Registration : Core : ${registerAttempts}/${maxRegisterAttempts} : ${error.message} : Retrying...`)
      }

      registerAttempts += 1
      if (registerAttempts > maxRegisterAttempts) {
        // We've retried with no success
        // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
        // won't force a restart since this situation will not resolve itself.
        console.error(`ERROR : ********************************************`)
        console.error(`ERROR : Registration : Failed : Max Retries Reached!`)
        console.error(`ERROR : ********************************************`)
        apiServer.setRegistration(false)

        return
      }

      await utils.sleepAsync(retryWaitTimeMs)
    }
  }
}

async function initPublicKeysAsync (coreConfig) {
  // check to see if public keys exists in database
  try {
    let pubKeys = await publicKeys.getLocalPublicKeysAsync()
    if (!pubKeys) {
      // if no public keys are present in database, store keys from coreConfig in DB and return them
      await publicKeys.storeConfigPubKeyAsync(coreConfig.public_keys)
      pubKeys = await publicKeys.getLocalPublicKeysAsync()
    }
    return pubKeys
  } catch (error) {
    throw new Error(`Registration : Unable to initialize Core public keys.`)
  }
}

// synchronize Node calendar with Core calendar, retreive all missing blocks
async function syncNodeCalendarAsync (coreConfig, pubKeys) {
  // pull down Core calendar until Node calendar is in sync, startup = true
  await calendar.syncNodeCalendarAsync(true, coreConfig, pubKeys)
}

// start all functions meant to run on a periodic basis
function startIntervals (coreConfig) {
  // start the interval process for keeping the calendar data up to date
  calendar.startPeriodicUpdateAsync(coreConfig, CALENDAR_UPDATE_SECONDS * 1000)
  // start the interval processes for validating Node calendar data
  let validateRecentIntervalMS = CALENDAR_VALIDATE_RECENT_SECONDS * 1000
  let validateAllIntervalMS = CALENDAR_VALIDATE_ALL_SECONDS * 1000
  setTimeout(() => { calendar.startValidateRecentNodeAsync(validateRecentIntervalMS) }, validateRecentIntervalMS)
  setTimeout(() => { calendar.startValidateFullNodeAsync(validateAllIntervalMS) }, validateAllIntervalMS)
  // start the interval processes for calculating the solution to the Core audit challenge
  calendar.startCalculateChallengeSolutionAsync(SOLVE_CHALLENGE_INTERVAL_MS, IS_PRIVATE_NODE)
}

async function nodeHeartbeat (nodeUri) {
  try {
    let response = await rp({
      method: 'GET',
      uri: `${nodeUri}/config`,
      json: true,
      gzip: true,
      resolveWithFullResponse: true,
      timeout: 5000
    })

    if (response.statusCode === 200) {
      console.log(`INFO : App : Node URI Health Check OK for URI : ${nodeUri}`)
      return Promise.resolve()
    } else { throw new Error() }
  } catch (error) {
    return Promise.reject(new Error(`Node URI Health Check Failed for URI : ${nodeUri}`))
  }
}

async function migrateCalendarDataAsync () {
  let batchSize = 100000
  try {
    // check to see if the rocksDB already has data, if so, abort migration
    let topRocksBlock = await rocksDB.getTopCalendarBlockAsync()
    if (topRocksBlock !== null) return
    // iterate through migration data in batches
    let startIndex = 0
    let blocks = []
    console.log(`INFO : App : Migrating calendar blocks`)
    do {
      // read blocks from postgres
      let endIndex = startIndex + batchSize - 1
      try {
        blocks = await CalendarBlock.findAll({ where: { id: { [Op.between]: [startIndex, endIndex] } }, order: [['id', 'ASC']], raw: true })
      } catch (error) {
        let err = `Unable to read blocks from postgres : ${error.message}`
        throw err
      }
      // write blocks to RocksDB
      try {
        await rocksDB.saveCalendarBlockBatchAsync(blocks)
      } catch (error) {
        let err = `Unable to write blocks to RocksDB : ${error.message}`
        throw err
      }
      if (blocks.length > 0) console.log(`INFO : App : Migrated calendar blocks ${startIndex} to ${blocks[blocks.length - 1].id}`)
      startIndex += batchSize
    } while (blocks.length > 0)
  } catch (error) {
    console.error(`ERROR : Unable to migrate calendar data : ${error}`)
  }
}

async function migrateProofStateAsync () {
  try {
    // read any existing proof state from redis
    let readisReady = redis !== null
    while (!readisReady) {
      await utils.sleepAsync(1000)
      readisReady = redis !== null
    }

    let aggDataKeys, lookupKeys
    try {
      aggDataKeys = await redis.keysAsync(`${env.CORE_SUBMISSION_KEY_PREFIX}*`)
      lookupKeys = await redis.keysAsync(`${env.HASH_NODE_LOOKUP_KEY_PREFIX}*`)
      if (aggDataKeys.length === 0 || lookupKeys.length === 0) return
    } catch (error) {
      let err = `Unable to read keys: ${error.message}`
      throw err
    }

    let aggDataItems, lookupItems
    try {
      aggDataItems = await redis.mgetAsync(aggDataKeys)
      lookupItems = await redis.mgetAsync(lookupKeys)
    } catch (error) {
      let err = `Unable to get values at keys: ${error.message}`
      throw err
    }

    // create proofDataItems from Redis proof state
    let aggData = aggDataKeys.reduce((result, key, index) => {
      let hashIdCore = key.split(':')[1]
      result[hashIdCore] = JSON.parse(aggDataItems[index])
      return result
    }, {})

    let nodeProofDataItems = lookupKeys.map((lookupKey, index) => {
      let hashIdNode = lookupKey.split(':')[1]
      let hashIdCore = lookupItems[index]
      let proofDataItem = aggData[hashIdCore].proof_data.find((item) => item.hash_id === hashIdNode)
      let hash = proofDataItem.hash
      let proofState = proofDataItem.partial_proof_path.reduce((result, item, index) => {
        // omit l: 'node_id:{hashIdNode}' which will be added on proof retrievalxs
        if (index === 0 || index === 1) return result
        // even number items contain values, odd contain hash operations
        // assuming sha-256 operations, we are only intersted in the values on even indexes
        if (index % 2 === 0) {
          if (item.l) {
            result.push(Buffer.from('00', 'hex'))
            result.push(Buffer.from(item.l, 'hex'))
          } else if (item.r) {
            result.push(Buffer.from('01', 'hex'))
            result.push(Buffer.from(item.r, 'hex'))
          }
        }
        return result
      }, [])

      let nodeProofDataItem = {}
      nodeProofDataItem.hashIdNode = hashIdNode
      nodeProofDataItem.hash = hash
      nodeProofDataItem.proofState = proofState
      nodeProofDataItem.hashIdCore = hashIdCore
      return nodeProofDataItem
    })

    // persist these proofDataItems to storage
    try {
      await rocksDB.saveProofStatesBatchAsync(nodeProofDataItems)
    } catch (error) {
      let err = `Unable to persist proof state data to disk : ${error.message}`
      throw err
    }

    // delete from redis
    try {
      await redis.delAsync([...aggDataKeys, ...lookupKeys])
      await redis.bgrewriteaofAsync()
    } catch (error) {
      let err = `Unable to delete proof state from Redis : ${error.message}`
      throw err
    }
  } catch (error) {
    console.error(`ERROR : Unable to migrate proof state : ${error}`)
  }
}

async function migrateOtherValuesAsync () {
  try {
    let challengeResponse = await redis.getAsync('challenge_response')
    let dataFromCore = await redis.getAsync('dataFromCore')
    let dataFromCoreLastReceived = await redis.getAsync('dataFromCoreLastReceived')
    let lastCoreRequestPayload = await redis.getAsync('lastCoreRequestPayload')
    let lastCoreRequestPayloadDate = await redis.getAsync('lastCoreRequestPayloadDate')
    let currentCoreHost = await redis.getAsync('CurrentCoreHost')
    let coreHostTXT = await redis.smembersAsync('CoreHostTXT')

    if (challengeResponse) await rocksDB.setAsync('challenge_response', challengeResponse)
    if (dataFromCore) await rocksDB.setAsync('dataFromCore', dataFromCore)
    if (dataFromCoreLastReceived) await rocksDB.setAsync('dataFromCoreLastReceived', dataFromCoreLastReceived)
    if (lastCoreRequestPayload) await rocksDB.setAsync('lastCoreRequestPayload', lastCoreRequestPayload)
    if (lastCoreRequestPayloadDate) await rocksDB.setAsync('lastCoreRequestPayloadDate', lastCoreRequestPayloadDate)
    if (currentCoreHost) await rocksDB.setAsync('currentCoreHost', currentCoreHost)
    if (coreHostTXT) await rocksDB.setAsync('coreHostTXT', JSON.stringify({ hosts: coreHostTXT }))

    await redis.delAsync(['challenge_response', 'dataFromCore', 'dataFromCoreLastReceived', 'lastCoreRequestPayload', 'lastCoreRequestPayloadDate', 'CurrentCoreHost', 'CoreHostTXT'])
  } catch (error) {
    console.error(`ERROR : Unable to migrate variables : ${error.message}`)
  }
}

async function migrateHMACKeysAsync () {
  try {
    let allHMACKeys = await HMACKey.findAll()
    for (let key of allHMACKeys) {
      await rocksDB.saveHMACKeyAsync(key)
    }
  } catch (error) {
    console.error(`ERROR : Unable to migrate HMAC keys : ${error.message}`)
  }
}

// process all steps need to start the application
async function startAsync () {
  try {
    console.log(`INFO : App : Starting : Version ${version}`)
    openRedisConnection(env.REDIS_CONNECT_URI)
    await openStorageConnectionAsync()
    await coreHosts.initCoreHostsFromDNSAsync()
    let nodeUri = await validateUriAsync(env.CHAINPOINT_NODE_PUBLIC_URI)
    IS_PRIVATE_NODE = (nodeUri === null)
    await migrateHMACKeysAsync()
    // Register HMAC Key
    await authKeysUpdate()
    let hmacKey = await registerNodeAsync(nodeUri)
    apiServer.setHmacKey(hmacKey)
    let coreConfig = await coreHosts.getCoreConfigAsync()
    let pubKeys = await initPublicKeysAsync(coreConfig)
    await eventMetrics.loadMetricsAsync()
    await migrateCalendarDataAsync()
    await migrateProofStateAsync()
    await migrateOtherValuesAsync()
    await apiServer.startAsync()
    // start the interval processes for aggregating and submitting hashes to Core
    apiServer.startAggInterval(coreConfig.node_aggregation_interval_seconds)
    apiServer.setPublicKeySet(pubKeys)
    await calendar.initNodeTopBlockAsync()

    // Perform Heartbeat check on /config to make sure node is operational and is capable of passing audits
    if (nodeUri) {
      await nodeHeartbeat(nodeUri)
    }

    console.log('INFO : Calendar : Starting Sync...')
    await syncNodeCalendarAsync(coreConfig, pubKeys)
    startIntervals(coreConfig)
    console.log('INFO : Calendar : Sync completed!')
  } catch (err) {
    console.error(`ERROR : App : Startup : ${err}`)
    // Unrecoverable Error : Exit cleanly (!), so Docker Compose `on-failure` policy
    // won't force a restart since this situation will not resolve itself.
    process.exit(0)
  }
}

// get the whole show started
startAsync()
