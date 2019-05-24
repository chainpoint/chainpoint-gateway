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
const validator = require('validator')
const ip = require('ip')
const url = require('url')

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

// Ensure that the URI provided is valid
// Returns either a valid public URI that can be registered, or null
function validateNodeUri(nodeURI, asPrivate) {
  if (_.isEmpty(nodeURI)) return null

  // Valid URI with restrictions
  // Blacklisting 0.0.0.0 since its not considered a private IP
  let isValidURI = validator.isURL(nodeURI, {
    protocols: ['http'],
    require_protocol: true,
    host_blacklist: ['0.0.0.0']
  })

  let parsedURI = url.parse(nodeURI)
  let parsedURIHost = parsedURI.hostname
  let uriHasValidPort = !!(parsedURI.port === null || parsedURI.port === '80')
  let uriHasValidIPHost = validator.isIP(parsedURIHost || '', 4)

  if (
    isValidURI &&
    uriHasValidIPHost &&
    (asPrivate ? ip.isPrivate(parsedURIHost) : !ip.isPrivate(parsedURIHost)) &&
    uriHasValidPort
  ) {
    return nodeURI
  } else if (isValidURI && uriHasValidIPHost && !asPrivate && ip.isPrivate(parsedURIHost)) {
    throw new Error(
      `RFC1918 Private IP Addresses like "${parsedURIHost}" cannot be specified as CHAINPOINT_NODE_PUBLIC_URI`
    )
  } else if (isValidURI && uriHasValidIPHost && asPrivate && !ip.isPrivate(parsedURIHost)) {
    throw new Error(`CHAINPOINT_NODE_PRIVATE_URI must be a RFC1918 Private IP Addresses`)
  } else if (!uriHasValidPort) {
    throw new Error('CHAINPOINT_NODE_PUBLIC_URI only supports the use of port 80')
  } else {
    return null
  }
}

function validateReflectedUri(val) {
  let env = process.env
  const enumerals = ['public', 'private']

  if (!enumerals.includes(val))
    throw new Error('CHAINPOINT_NODE_REFLECT_PUBLIC_OR_PRIVATE only accepts a value of "public" or "private"')
  else if (env.CHAINPOINT_NODE_PUBLIC_URI === '' && env.CHAINPOINT_NODE_PRIVATE_URI === '')
    throw new Error(
      'CHAINPOINT_NODE_REFLECT_PUBLIC_OR_PRIVATE requires that a valid value be set for "CHAINPOINT_NODE_PUBLIC_URI" or "CHAINPOINT_NODE_PRIVATE_URI"'
    )
  else if (env[`CHAINPOINT_NODE_${val.toUpperCase()}_URI`] === '')
    throw new Error(
      `${`CHAINPOINT_NODE_${val.toUpperCase()}_URI`} is required as it has been set as the CHAINPOINT_NODE_REFLECT_PUBLIC_OR_PRIVATE`
    )
}

module.exports = {
  sleepAsync: sleepAsync,
  addMinutes: addMinutes,
  addSeconds: addSeconds,
  formatDateISO8601NoMs: formatDateISO8601NoMs,
  lowerCaseHashes: lowerCaseHashes,
  parseAnchorsComplete: parseAnchorsComplete,
  isHex: isHex,
  randomIntFromInterval: randomIntFromInterval,
  nodeUIPasswordBooleanCheck: nodeUIPasswordBooleanCheck,
  validateNodeUri: validateNodeUri,
  validateReflectedUri: validateReflectedUri
}
