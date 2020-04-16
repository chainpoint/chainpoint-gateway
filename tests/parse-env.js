/* global describe, it */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const parseEnv = require('../lib/parse-env.js')

describe('Environment variables', () => {
  describe('valCoreIPList', () => {
    it('should return success with empty string', done => {
      let result = parseEnv.valCoreIPList('')
      expect(result).to.equal('')
      done()
    })
    it('should throw error with bad single IP', done => {
      expect(() => {
        parseEnv.valCoreIPList('234234.234234.234234.23434')
      }).to.throw('The Core IP list contains an invalid entry')
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
      }).to.throw('The Core IP list contains an invalid entry')
      done()
    })
    it('should throw error with missing IP in group', done => {
      expect(() => {
        parseEnv.valCoreIPList('65.1.1.1,,10.165.32.31')
      }).to.throw('The Core IP list contains an invalid entry')
      done()
    })
    it('should throw error with duplicate IP in group', done => {
      expect(() => {
        parseEnv.valCoreIPList('65.1.1.1,65.1.1.1,10.165.32.31')
      }).to.throw('The Core IP list cannot contain duplicates')
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
