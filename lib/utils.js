const fs = require('fs')
const request = require('request')

function fileExists (path) {
  return fs.existsSync(path)
}

function readFile (path, asBinary) {
  if (!fileExists(path)) return false
  let contents = null
  try {
    contents = fs.readFileSync(path, { encoding: asBinary ? null : 'utf8' })
  } catch (err) {
    console.log(err)
    return false
  }
  return contents
}

function writeFile (path, contents) {
  try {
    fs.writeFileSync(path, contents)
  } catch (err) {
    return false
  }
  return true
}

function getStackConfig (baseURI, callback) {
  let options = {
    headers: {
      'Content-Type': 'application/json'
    },
    method: 'GET',
    uri: baseURI + '/config',
    json: true,
    gzip: true
  }
  request(options, (err, response, body) => {
    if (err) return callback(err)
    if (response.statusCode !== 200) return callback({ message: 'Invalid response' })
    return callback(null, body)
  })
}

module.exports = {
  fileExists: fileExists,
  readFile: readFile,
  writeFile: writeFile,
  getStackConfig: getStackConfig
}
