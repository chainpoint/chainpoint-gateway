#!/usr/bin/env node

const fs = require('fs')

function main () {
  const path = './keys/backups/'
  let backupDate = new Date()

  console.log('***************************************************')
  console.log('Chainpoint Node Auth Keys (HMAC) Backup')
  console.log('Created:', backupDate.toISOString())
  console.log('Prints ETH address, HMAC Key, and Restore Command')
  console.log('***************************************************\n')

  fs.readdir(path, function (err, items) {
    if (err) {
      console.error(`Could not read from ${path} : ${err}`)
      return
    }

    for (var i = 0; i < items.length; i++) {
      var match = new RegExp(/\.(key)/g)
      if (match.test(items[i])) {
        console.log(items[i])
        var buffer = Buffer.from(fs.readFileSync(path + items[i], 'utf8'))
        console.log(buffer.toString())
        console.log(`echo -n "${buffer.toString()}" > keys/${items[i]}` + '\n')
      }
    }
  })
}

main()
