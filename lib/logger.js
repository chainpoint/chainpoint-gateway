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

// load environment variables
let env = require('./parse-env.js').env

const winston = require('winston')

const myFormat = winston.format.printf(
  ({ level, message, timestamp }) => `${env.NODE_PUBLIC_IP_ADDRESS} | ${timestamp} | ${level} : ${message}`
)

let consoleOpts = {
  level: 'info',
  stderrLevels: ['error'],
  format: winston.format.combine(winston.format.colorize({ all: true }), winston.format.timestamp(), myFormat)
}
if (env.NODE_ENV === 'test') consoleOpts.silent = true

const logger = winston.createLogger({
  transports: [new winston.transports.Console(consoleOpts)]
})

module.exports = logger
