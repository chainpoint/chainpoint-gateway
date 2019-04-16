module.exports = function(join, f1, f2) {
  return function(...args) {
    return join(f1(...args), f2(...args))
  }
}
