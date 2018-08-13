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

const rocksDB = require('./models/RocksDB.js')
const crypto = require('crypto')

// TweetNaCl.js
// see: http://ed25519.cr.yp.to
// see: https://github.com/dchest/tweetnacl-js#signatures
const nacl = require('tweetnacl')
nacl.util = require('tweetnacl-util')

async function getLocalPublicKeysAsync () {
  let pubKeys = await rocksDB.getAllPublicKeysAsync()
  if (pubKeys.length > 0) {
    // if public keys already exist in database, return them
    let results = {}
    for (let x = 0; x < pubKeys.length; x++) {
      // before add an item to the results, ensure that the pubKeyHash is valid
      // if it is not valid, log the error and exclude from the results
      let pubKeyBytes = nacl.util.decodeBase64(pubKeys[x].pubKey)
      let pubKeyBytesHashHex = crypto.createHash('sha256').update(pubKeyBytes).digest('hex')
      let pubKeyHash = pubKeyBytesHashHex.substr(0, 12)
      if (pubKeys[x].pubKeyHash === pubKeyHash) {
        results[pubKeys[x].pubKeyHash] = pubKeyBytes
      } else {
        console.error(`ERROR : An invalid key ${pubKeys[x].pubKeyHash}:${pubKeys[x].pubKey} was found in the database and will be ignored`)
      }
    }
    return results
  }
  return null
}

async function storeConfigPubKeyAsync (publicKeys) {
  let pubKeyItems = []
  for (var publicKeyHash in publicKeys) {
    if (publicKeys.hasOwnProperty(publicKeyHash)) {
      pubKeyItems.push({ pubKeyHash: publicKeyHash, pubKey: publicKeys[publicKeyHash] })
    }
  }
  await rocksDB.savePublicKeysAsync(pubKeyItems)
}

// retrieve the latest public key set from Core
async function getLatestCorePublicKeySetAsync (coreHosts, publicKeySet) {
  // the key isnt found in the known set, get latest keys from Core config
  let coreConfig = await coreHosts.getCoreConfigAsync()
  // write new keys to the database
  let newKeys = []
  for (var publicKeyHash in coreConfig.public_keys) {
    if (coreConfig.public_keys.hasOwnProperty(publicKeyHash) && !publicKeySet[publicKeyHash]) {
      newKeys.push({ pubKeyHash: publicKeyHash, pubKey: coreConfig.public_keys[publicKeyHash] })
    }
  }
  await storeConfigPubKeyAsync(newKeys)
  return getLocalPublicKeysAsync()
}

// validate a block's signature given the block hash, signature, and public key
async function validateSignatureAsync (dataHex, pubKey, sig) {
  let isValidSig
  try {
    let dataBytes = nacl.util.decodeUTF8(dataHex)

    // if the key is null, return false
    if (!pubKey) return false

    let signatureBytes = nacl.util.decodeBase64(sig)
    isValidSig = nacl.sign.detached.verify(dataBytes, signatureBytes, pubKey)
  } catch (error) {
    return false
  }
  return isValidSig
}

module.exports = {
  getLocalPublicKeysAsync: getLocalPublicKeysAsync,
  storeConfigPubKeyAsync: storeConfigPubKeyAsync,
  getLatestCorePublicKeySetAsync: getLatestCorePublicKeySetAsync,
  validateSignatureAsync: validateSignatureAsync
}
