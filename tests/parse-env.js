/* global describe, it */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const parseEnv = require('../lib/parse-env.js')

describe('Environment variables', () => {
  describe('valBase64', () => {
    it('should throw error with number', done => {
      expect(() => {
        parseEnv.valBase64(234)
      }).to.throw('Expected string but received a number')
      done()
    })
    it('should throw error with boolean', done => {
      expect(() => {
        parseEnv.valBase64(true)
      }).to.throw('Expected string but received a boolean')
      done()
    })
    it('should return error on empty string', done => {
      expect(() => {
        parseEnv.valBase64('')
      }).to.throw('The supplied value must be a valid Base 64 encoded string')
      done()
    })
    it('should return error on non Base 64 encoded string', done => {
      expect(() => {
        parseEnv.valBase64('Not base 64 encoded')
      }).to.throw('The supplied value must be a valid Base 64 encoded string')
      done()
    })
    it('should return value with proper base 64 encoded string', done => {
      let result = parseEnv.valBase64('cXdlCg==')
      expect(result).to.equal('cXdlCg==')
      done()
    })
  })

  describe('valSocket', () => {
    it('should throw error with number', done => {
      expect(() => {
        parseEnv.valSocket(234)
      }).to.throw('The supplied value must be a valid <host>:<port> string')
      done()
    })
    it('should throw error with boolean', done => {
      expect(() => {
        parseEnv.valSocket(true)
      }).to.throw('The supplied value must be a valid <host>:<port> string')
      done()
    })
    it('should return error on empty string', done => {
      expect(() => {
        parseEnv.valSocket('')
      }).to.throw('The supplied value must be a valid <host>:<port> string')
      done()
    })
    it('should return error on single segment string', done => {
      expect(() => {
        parseEnv.valSocket('127.0.0.1')
      }).to.throw('The supplied value must be a valid <host>:<port> string')
      done()
    })
    it('should return error on 3+ segment string', done => {
      expect(() => {
        parseEnv.valSocket('127.0.0.1:2342:sdfs')
      }).to.throw('The supplied value must be a valid <host>:<port> string')
      done()
    })
    it('should return error on bad host', done => {
      expect(() => {
        parseEnv.valSocket('badhost:2342')
      }).to.throw('The supplied value must be a valid <host>:<port> string')
      done()
    })
    it('should return error on bad port string', done => {
      expect(() => {
        parseEnv.valSocket('goodhost.com:badport')
      }).to.throw('The supplied value must be a valid <host>:<port> string')
      done()
    })
    it('should return error on invalid port number', done => {
      expect(() => {
        parseEnv.valSocket('goodhost.com:345345345345')
      }).to.throw('The supplied value must be a valid <host>:<port> string')
      done()
    })
    it('should return value with host:port string', done => {
      let result = parseEnv.valSocket('goodhost.com:10009')
      expect(result).to.equal('goodhost.com:10009')
      done()
    })
  })

  describe('valCoreIPList', () => {
    it('should return success with empty string', done => {
      let result = parseEnv.valCoreIPList('')
      expect(result).to.equal('')
      done()
    })
    it('should throw error with bad single IP', done => {
      expect(() => {
        parseEnv.valCoreIPList('234234.234234.234234.23434')
      }).to.throw('The Core IP list is invalid')
      done()
    })
    it('should return true with valid v4 IP', done => {
      let result = parseEnv.valCoreIPList('65.1.1.1')
      expect(result).to.deep.equal(['65.1.1.1'])
      done()
    })
    it('should return success with valid v6 IP', done => {
      let result = parseEnv.valCoreIPList('FE80:0000:0000:0000:0202:B3FF:FE1E:8329')
      expect(result).to.deep.equal(['FE80:0000:0000:0000:0202:B3FF:FE1E:8329'])
      done()
    })
    it('should return success with valid collapsed v6 IP', done => {
      let result = parseEnv.valCoreIPList('FE80::0202:B3FF:FE1E:8329')
      expect(result).to.deep.equal(['FE80::0202:B3FF:FE1E:8329'])
      done()
    })
    it('should return success with hybrid v6 IP', done => {
      let result = parseEnv.valCoreIPList('::ffff:65.1.1.1')
      expect(result).to.deep.equal(['::ffff:65.1.1.1'])
      done()
    })
    it('should throw error with bad IP in group', done => {
      expect(() => {
        parseEnv.valCoreIPList('65.1.1.1,10.165.32.31,234234.234234.234234.23434')
      }).to.throw('The Core IP list is invalid')
      done()
    })
    it('should throw error with missing IP in group', done => {
      expect(() => {
        parseEnv.valCoreIPList('65.1.1.1,,10.165.32.31')
      }).to.throw('The Core IP list is invalid')
      done()
    })
    it('should throw error with duplicate IP in group', done => {
      expect(() => {
        parseEnv.valCoreIPList('65.1.1.1,65.1.1.1,10.165.32.31')
      }).to.throw('The Core IPs cannot contain duplicates')
      done()
    })
    it('should return success with valid IP list', done => {
      let result = parseEnv.valCoreIPList('65.1.1.1,FE80::0202:B3FF:FE1E:8329,10.165.32.31')
      expect(result).to.deep.equal(['65.1.1.1', 'FE80::0202:B3FF:FE1E:8329', '10.165.32.31'])
      done()
    })
  })

  describe('valNetwork', () => {
    it('should throw error with number', done => {
      expect(() => {
        parseEnv.valNetwork(234)
      }).to.throw('The NETWORK value is invalid')
      done()
    })
    it('should throw error with boolean', done => {
      expect(() => {
        parseEnv.valNetwork(true)
      }).to.throw('The NETWORK value is invalid')
      done()
    })
    it('should return mainnet on empty', done => {
      let result = parseEnv.valNetwork('')
      expect(result).to.equal('mainnet')
      done()
    })
    it('should return mainnet on mainnet', done => {
      let result = parseEnv.valNetwork('mainnet')
      expect(result).to.equal('mainnet')
      done()
    })
    it('should return testnet on testnet', done => {
      let result = parseEnv.valNetwork('testnet')
      expect(result).to.equal('testnet')
      done()
    })
  })
})
