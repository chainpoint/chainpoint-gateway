const { promisify } = require('util')
const request = require('request')

// wait for a specified number of milliseconds to elapse
function timeout (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
async function sleepAsync (ms) {
  await timeout(ms)
}

async function getStackConfigAsync (baseURI) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: baseURI + '/config',
    json: true,
    gzip: true
  }

  let requestAsync = promisify(request)
  let response = await requestAsync(options)
  if (response.statusCode !== 200) throw new Error('Invalid response')
  return response.body
}

/**
 * Add specified seconds to a Date object
 *
 * @param {Date} date - The starting date
 * @param {number} seconds - The seconds of seconds to add to the date
 * @returns {Date}
 */
function addSeconds (date, seconds) {
  return new Date(date.getTime() + (seconds * 1000))
}

/**
 * Add specified minutes to a Date object
 *
 * @param {Date} date - The starting date
 * @param {number} minutes - The number of minutes to add to the date
 * @returns {Date}
 */
function addMinutes (date, minutes) {
  return new Date(date.getTime() + (minutes * 60000))
}

/**
 * Convert Date to ISO8601 string, stripping milliseconds
 * '2017-03-19T23:24:32Z'
 *
 * @param {Date} date - The date to convert
 * @returns {string} An ISO8601 formatted time string
 */
function formatDateISO8601NoMs (date) {
  return date.toISOString().slice(0, 19) + 'Z'
}

/**
 * Convert strings in an Array of hashes to lower case
 *
 * @param {string[]} hashes - An array of string hashes to convert to lower case
 * @returns {string[]} An array of lowercase hash strings
 */
function lowerCaseHashes (hashes) {
  return hashes.map((hash) => {
    return hash.toLowerCase()
  })
}

module.exports = {
  sleepAsync: sleepAsync,
  getStackConfigAsync: getStackConfigAsync,
  addMinutes: addMinutes,
  addSeconds: addSeconds,
  formatDateISO8601NoMs: formatDateISO8601NoMs,
  lowerCaseHashes: lowerCaseHashes
}
