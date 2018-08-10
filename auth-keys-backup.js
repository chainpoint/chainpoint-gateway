const fs = require('fs')
const path = require('path')
const rocksDB = require('./lib/models/RocksDB.js')

// establish a connection with the database
async function openStorageConnectionAsync () {
  await rocksDB.openConnectionAsync()
}

/**
 * Backup Auth Keys Handler - Has the following signature for isomorphic purposes so the function can be used as
 * an HTTP event handler
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
async function backupAuthKeys (req, res, next) {
  console.log(`INFO : BackupAuthKeys : Starting Auth key backups...`)
  try {
    let HMACKeys = await rocksDB.getAllHMACKeysAsync()
    let results = HMACKeys.map((key) => {
      // Check to see if backup keys dir exists
      if (!fs.existsSync(`${path.resolve('./keys')}`)) {
        fs.mkdirSync(`${path.resolve('./keys')}`)
      } else if (!fs.existsSync(`${path.resolve('./keys/backups')}`)) {
        fs.mkdirSync(`${path.resolve('./keys/backups')}`)
      }

      fs.writeFileSync(`${path.resolve('./keys/backups')}/${key.tntAddr}-${Date.now()}.key`, key.hmacKey)

      return `${key.tntAddr} Auth key has been backed up`
    })
    res.send(200, results)

    return next()
  } catch (err) {
    console.error(`ERROR : BackupAuthKeys : Unable to complete Auth key backup(s)`)
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
          console.log(`INFO : BackupAuthKeys : Key backup(s) complete for TNT addresses - ${message.map(currVal => currVal.split(' ')[0]).join(', ')}`)
          process.exit(0)
        } else if (status === 500) {
          throw new Error()
        }
      }
    }

    await backupAuthKeys(req, res, () => { })
  } catch (error) {
    console.error(`ERROR : BackupAuthKeys : Unable to complete key backup(s)`)
    process.exit(1)
  }
}

main()
