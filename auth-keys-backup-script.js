const fs = require('fs')
const path = require('path')
const hmacKey = require('./lib/models/HMACKey.js')
const utils = require('./lib/utils.js')

let HMACKey = hmacKey.HMACKey
let sequelizeHMACKey = hmacKey.sequelize

// establish a connection with the database
async function openStorageConnectionAsync () {
  let storageConnected = false
  let retryCount = 0
  while (!storageConnected) {
    try {
      await sequelizeHMACKey.sync({ logging: false })
      storageConnected = true
    } catch (error) {
      if (retryCount >= 1 && retryCount < 20) {
        console.error('ERROR : BackupAuthKeys : PostgreSQL not available : Will retry in 5 seconds...')
      } else if (retryCount > 20) {
        console.error('ERROR : BackupAuthKeys : Could not connect to PostgreSQL')
        process.exit(1)
      }
      retryCount += 1
      await utils.sleepAsync(5000)
    }
  }
}

/**
 * Backup Auth Keys Handler - Has the following signature for isomorphic purposes so the function can be used as
 * an HTTP event handler
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
async function backupAuthKeys (req, res, next) {
  console.log(`INFO : AuthKeys : Backing up Auth Key(s).`)
  try {
    let result = await HMACKey.findAll().then((keys) => {
      return keys.map((currVal) => {
        let key = currVal.get({plain: true})

        fs.writeFileSync(`${path.resolve('./keys/backups')}/${key.tntAddr}-${Date.now()}.key`, key.hmacKey)

        return `${key.tntAddr} hmac key has been backed up`
      })
    })
    res.send(200, result)

    return next()
  } catch (err) {
    console.error(`ERROR : BackupAuthKeys : Unable to generate backups for Auth Keys.`)
    res.send(500, 'Unable to generate backups for Auth Keys.')
  }
}

async function main () {
  await openStorageConnectionAsync()

  try {
    const req = { context: { caller: 'cli' } }
    const res = {
      send: (status, message) => {
        if (status === 200) {
          console.log(`INFO : BackupAuthKeys : Successfully backed up the following Auth Key(s) - ${message.map(currVal => currVal.split(' ')[0]).join(', ')}`)
          process.exit(0)
        } else if (status === 500) {
          throw new Error()
        }
      }
    }

    await backupAuthKeys(req, res, () => {})
  } catch (error) {
    console.error(`ERROR : BackupAuthKeys : AuthKeysBackup Script was unable to generate backups for Auth Keys.`)
    process.exit(1)
  }
}

main()
