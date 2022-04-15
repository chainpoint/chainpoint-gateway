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

const jmespath = require('jmespath')
const _ = require('lodash')

const flattenKeys = (obj, path = []) =>
  !_.isObject(obj)
    ? { [path.join('.')]: obj }
    : _.reduce(obj, (cum, next, key) => _.merge(cum, flattenKeys(next, [...path, key])), {})

// wait for a specified number of milliseconds to elapse
function sleepAsync(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Add specified seconds to a Date object
 *
 * @param {Date} date - The starting date
 * @param {number} seconds - The seconds of seconds to add to the date
 * @returns {Date}
 */
function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000)
}

/**
 * Add specified minutes to a Date object
 *
 * @param {Date} date - The starting date
 * @param {number} minutes - The number of minutes to add to the date
 * @returns {Date}
 */
function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000)
}

/**
 * Convert Date to ISO8601 string, stripping milliseconds
 * '2017-03-19T23:24:32Z'
 *
 * @param {Date} date - The date to convert
 * @returns {string} An ISO8601 formatted time string
 */
function formatDateISO8601NoMs(date) {
  return date.toISOString().slice(0, 19) + 'Z'
}

/**
 * Convert strings in an Array of hashes to lower case
 *
 * @param {string[]} hashes - An array of string hashes to convert to lower case
 * @returns {string[]} An array of lowercase hash strings
 */
function lowerCaseHashes(hashes) {
  return hashes.map(hash => {
    return hash.toLowerCase()
  })
}

function parseAnchorsComplete(proofObject, network) {
  // Because the minimum proof will contain a cal anchor, always start with cal
  let anchorsComplete = [network === 'mainnet' ? 'cal' : 'tcal'].concat(
    jmespath.search(proofObject, '[branches[].branches[].ops[].anchors[].type] | [0]')
  )
  return anchorsComplete
}

/**
 * Checks if value is a hexadecimal string
 *
 * @param {string} value - The value to check
 * @returns {bool} true if value is a hexadecimal string, otherwise false
 */
function isHex(value) {
  var hexRegex = /^[0-9a-f]{2,}$/i
  var isHex = hexRegex.test(value) && !(value.length % 2)
  return isHex
}

/**
 * Checks if value is a uuid string
 *
 * @param {string} value - The value to check
 * @returns {bool} true if value is a hexadecimal string, otherwise false
 */
function isUUID(value) {
  var uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/i
  return uuidRegex.test(value)
}

/**
 * Checks if value is a ulid string
 *
 * @param {string} value - The value to check
 * @returns {bool} true if value is a hexadecimal string, otherwise false
 */
function isULID(value) {
  var ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i
  return ulidRegex.test(value)
}

/**
 * converts a hex value to a uuid
 *
 * @param {string} value - The value to convert
 * @returns {string} the segmented uuid string
 */
function hexToUUIDv1(hexString) {
  if (hexString.length < 32) return null
  let segment1 = hexString.substring(0, 8)
  let segment2 = hexString.substring(8, 12)
  let segment3 = hexString.substring(12, 16)
  let segment4 = hexString.substring(16, 20)
  let segment5 = hexString.substring(20, 32)
  return `${segment1}-${segment2}-${segment3}-${segment4}-${segment5}`
}

/**
 * Returns a random Integer between min and max
 *
 * @param {Integer} min - The min value to be returned
 * @param {Integer} max - The max value to be returned
 * @returns {Integer} The selected random Integer between min and max
 */
function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

function nodeUIPasswordBooleanCheck(pw = '') {
  if (_.isBoolean(pw) && pw === false) {
    return false
  } else {
    let password = pw.toLowerCase()

    if (password === 'false') return false
  }

  return pw
}

/**
 * Extracts the IP address from a Restify request object
 *
 * @param {req} value - The Restify request object
 * @returns {string} - The IP address, or null if it cannot be determined
 */
function getClientIP(req) {
  let xff, rcr, rsa
  try {
    xff = req.headers['x-forwarded-for']
  } catch (error) {
    xff = null
  }
  try {
    rcr = req.connection.remoteAddress
  } catch (error) {
    rcr = null
  }
  try {
    rsa = req.socket.remoteAddress
  } catch (error) {
    rsa = null
  }

  let result = xff || rcr || rsa
  if (result) result = result.replace('::ffff:', '')

  return result || null
}

function jsonTransform(json, conditionFn, modifyFn) {
  // transform { responses: { category: 'first' } } to { 'responses.category': 'first' }
  const flattenedKeys = Object.keys(flattenKeys(json))

  // Easily iterate over the flat json
  for (let i = 0; i < flattenedKeys.length; i++) {
    const key = flattenedKeys[i]
    const value = _.get(json, key)
    // Did the condition match the one we passed?
    if (conditionFn(key, value)) {
      // Replace the value to the new one
      _.set(json, key, modifyFn(key, value))
    }
  }

  return json
}

module.exports = {
  sleepAsync: sleepAsync,
  addMinutes: addMinutes,
  addSeconds: addSeconds,
  formatDateISO8601NoMs: formatDateISO8601NoMs,
  lowerCaseHashes: lowerCaseHashes,
  parseAnchorsComplete: parseAnchorsComplete,
  isHex: isHex,
  isUUID: isUUID,
  isULID: isULID,
  hexToUUIDv1: hexToUUIDv1,
  randomIntFromInterval: randomIntFromInterval,
  nodeUIPasswordBooleanCheck: nodeUIPasswordBooleanCheck,
  getClientIP: getClientIP,
  jsonTransform: jsonTransform
}
