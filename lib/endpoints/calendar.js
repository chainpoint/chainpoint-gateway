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

const _ = require('lodash')
const errors = require('restify-errors')
const calendarBlock = require('../models/CalendarBlock.js').CalendarBlock

/**
 * GET /calendar/:height handler
 *
 * Expects a path parameter 'height' as an integer
 *
 * Returns block object for calendar block by calendar height
 */
async function getCalBlockByHeightV1Async (req, res, next) {
  let height = parseInt(req.params.height, 10)

  // ensure that :height is an integer
  if (!_.isInteger(height) || height < 0) {
    return next(new errors.InvalidArgumentError('Invalid height, must be a positive integer'))
  }

  try {
    let block = await calendarBlock.findOne({ where: { id: height } })
    if (!block) return next(new errors.NotFoundError())
    res.contentType = 'application/json'
    block.id = parseInt(block.id, 10)
    block.time = parseInt(block.time, 10)
    block.version = parseInt(block.version, 10)
    res.send(block)
    return next()
  } catch (error) {
    return next(new errors.InternalError('Node internal error retrieving Calendar block by height'))
  }
}

module.exports = {
  getCalBlockByHeightV1Async: getCalBlockByHeightV1Async
}
