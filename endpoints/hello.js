
/**
 * GET / handler
 *
 * Root path handler with hello message.
 *
 */
function getV1 (req, res, next) {
  let results = {
    message: 'hello!',
    date: new Date().toISOString()
  }
  res.send(results)
  return next()
}

module.exports = {
  getV1: getV1
}
