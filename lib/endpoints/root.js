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

const errors = require('restify-errors')

/**
 * GET / handler
 *
 * Root path handler with default message.
 *
 */
function getV1(req, res, next) {
  res.contentType = 'application/json'
  return next(
    new errors.ImATeapotError(
      'This is an API endpoint. Please consult https://chainpoint.org'
    )
  )
}

module.exports = {
  getV1: getV1
}
