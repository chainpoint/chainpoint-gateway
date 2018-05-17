#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function main() {
  const path = "./keys/backups/";
  let backupDate = new Date()

  console.log('***************************************')
  console.log('Chainpoint Node Auth Keys (HMAC) Backup')
  console.log('Created:', backupDate.toISOString())
  console.log('***************************************\n')

  fs.readdir(path, function (err, items) {
    let sortedItems = items.sort

    for (var i = 0; i < items.length; i++) {
      var match = new RegExp(/\.(key)/g);
      if (match.test(items[i])) {
        console.log(items[i])
        var buffer = new Buffer(fs.readFileSync(path + items[i], 'utf8'))
        console.log(buffer.toString() + '\n')
      }
    }
  })
}

main()
