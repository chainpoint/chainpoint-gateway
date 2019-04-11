module.exports = function(fn1, fn2) {
  return function(...args) {
    fn1(...args)

    return fn2(...args)
  }
}
