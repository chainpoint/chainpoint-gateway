const _ = require('lodash')
const restify = require('restify')
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
    return next(new restify.InvalidArgumentError('invalid request, height must be a positive integer'))
  }

  try {
    let block = await calendarBlock.findOne({ where: { id: height } })
    if (!block) return next(new restify.NotFoundError())
    res.contentType = 'application/json'
    block.id = parseInt(block.id, 10)
    block.time = parseInt(block.time, 10)
    block.version = parseInt(block.version, 10)
    res.send(block)
    return next()
  } catch (error) {
    console.log(error)
    return next(new restify.InternalError(error))
  }
}

module.exports = {
  getCalBlockByHeightV1Async: getCalBlockByHeightV1Async
}
