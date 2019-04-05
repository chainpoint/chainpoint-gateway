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

const errors = require('restify-errors')
let cores = require('../cores.js')

async function getDataValueByIDAsync(req, res, next) {
  res.contentType = 'application/json'

  let txId = req.params.tx_id

  // validate TM txId is well formed
  let containsValidTxId = /^([a-fA-F0-9]{2}){32}$/.test(txId)

  if (!containsValidTxId) {
    return next(new errors.InvalidArgumentError('invalid JSON body, invalid txId present'))
  }

  // check Core for the transaction
  let txInfo = await cores.getCachedTransactionAsync(txId)
  if (txInfo === null || txInfo.tx === undefined || txInfo.tx.data === undefined) {
    return next(new errors.NotFoundError())
  }

  res.contentType = 'text/plain'
  res.send(txInfo.tx.data.toLowerCase())
  return next()
}

module.exports = {
  getDataValueByIDAsync: getDataValueByIDAsync,
  // additional functions for testing purposes
  setCores: c => {
    cores = c
  }
}
