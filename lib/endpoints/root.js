const restify = require('restify')

/**
 * GET / handler
 *
 * Root path handler with default message.
 *
 */
function getV1 (req, res, next) {
  return next(new restify.ImATeapotError('This is an API endpoint. Please consult https://chainpoint.org'))
}

module.exports = {
  getV1: getV1
}
