/* global describe, it */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const fs = require('fs')
const app = require('../lib/utils.js')

describe('Sleep function', () => {
  it('should sleep for 100ms', done => {
    let amount = 100
    let startMS = Date.now()
    app.sleepAsync(amount).then(() => {
      let elapsedMS = Date.now() - startMS
      expect(elapsedMS).to.be.greaterThan(amount - 1)
      expect(elapsedMS).to.be.lessThan(amount + 15)
      done()
    })
  })
  it('should sleep for 1000ms', done => {
    let amount = 1000
    let startMS = Date.now()
    app.sleepAsync(amount).then(() => {
      let elapsedMS = Date.now() - startMS
      expect(elapsedMS).to.be.greaterThan(amount - 1)
      expect(elapsedMS).to.be.lessThan(amount + 15)
      done()
    })
  })
})

describe('Date functions', () => {
  it('addSeconds should return correct result', done => {
    let addend = 55
    let startDate = new Date(2019, 0, 1, 0, 0, 0, 0)
    let expectedDate = new Date(2019, 0, 1, 0, 0, addend, 0)
    let calculatedDate = app.addSeconds(startDate, addend)
    expect(calculatedDate.getTime()).to.equal(expectedDate.getTime())
    done()
  })
  it('addMinutes should return correct result', done => {
    let addend = 55
    let startDate = new Date(2019, 0, 1, 0, 0, 0, 0)
    let expectedDate = new Date(2019, 0, 1, 0, addend, 0, 0)
    let calculatedDate = app.addMinutes(startDate, addend)
    expect(calculatedDate.getTime()).to.equal(expectedDate.getTime())
    done()
  })
  it('formatDateISO8601NoMs should return correct result', done => {
    let startDate = new Date('2019-02-06T18:14:35.576Z')
    let expectedDate = '2019-02-06T18:14:35Z'
    let calculatedDate = app.formatDateISO8601NoMs(startDate)
    expect(calculatedDate.toString()).to.equal(expectedDate)
    done()
  })
})

describe('Hash format function', () => {
  it('lowerCaseHashes should return correct result', done => {
    let startHashes = ['A1b2, ABCDef010101Cd']
    let expectedHashes = ['a1b2, abcdef010101cd']
    let calculatedHashes = app.lowerCaseHashes(startHashes)
    expect(calculatedHashes.length).to.equal(expectedHashes.length)
    expect(calculatedHashes[0]).to.equal(expectedHashes[0])
    expect(calculatedHashes[1]).to.equal(expectedHashes[1])
    done()
  })
})

describe('Proof parsing function', () => {
  it('parseAnchorsComplete should return correct result for cal proof', done => {
    let proofJSON = fs.readFileSync('./tests/sample-data/cal-proof.chp.json')
    let proofObj = JSON.parse(proofJSON)
    let res = app.parseAnchorsComplete(proofObj)
    expect(res.length).to.equal(1)
    expect(res[0]).to.equal('cal')
    done()
  })
  it('parseAnchorsComplete should return correct result for btc proof', done => {
    let proofJSON = fs.readFileSync('./tests/sample-data/btc-proof.chp.json')
    let proofObj = JSON.parse(proofJSON)
    let res = app.parseAnchorsComplete(proofObj)
    expect(res.length).to.equal(2)
    expect(res[0]).to.equal('cal')
    expect(res[1]).to.equal('btc')
    done()
  })
})

describe('Hex validation function', () => {
  it('isHex should return false for non hex value', done => {
    let val = 'nonhex'
    let res = app.isHex(val)
    expect(res).to.equal(false)
    done()
  })
  it('isHex should return false for non hex value', done => {
    let val = 'deadbeefcafe'
    let res = app.isHex(val)
    expect(res).to.equal(true)
    done()
  })
})

describe('Random number function', () => {
  it('randomIntFromInterval should produce random numbers within the specified range', done => {
    let iterations = 10000
    for (let i = 0; i < iterations; i++) {
      let min = Math.floor(Math.random() * 100)
      let max = min * Math.ceil(Math.random() * 99)
      let rnd = app.randomIntFromInterval(min, max)
      expect(rnd).to.be.gte(min)
      expect(rnd).to.be.lte(max)
    }
    // and test if bounds are inclusive
    let rnd = app.randomIntFromInterval(10, 10)
    expect(rnd).to.be.gte(10)
    expect(rnd).to.be.lte(10)
    done()
  })
})

describe('UI password check function', () => {
  it('should return false when value is false', done => {
    let val = false
    let res = app.nodeUIPasswordBooleanCheck(val)
    expect(res).to.equal(false)
    done()
  })
  it("should return false when value is 'false'", done => {
    let val = 'false'
    let res = app.nodeUIPasswordBooleanCheck(val)
    expect(res).to.equal(false)
    done()
  })
  it("should return false when value is 'FALSE'", done => {
    let val = 'FALSE'
    let res = app.nodeUIPasswordBooleanCheck(val)
    expect(res).to.equal(false)
    done()
  })
  it("should return false when value is 'False'", done => {
    let val = 'False'
    let res = app.nodeUIPasswordBooleanCheck(val)
    expect(res).to.equal(false)
    done()
  })
  it('should return password if not any variation of false', done => {
    let val = 'not false'
    let res = app.nodeUIPasswordBooleanCheck(val)
    expect(res).to.equal(val)
    done()
  })
})

describe('Validation functions', () => {
  describe('Validating public NodeURI', () => {
    it('should return null with empty URI', done => {
      let uri = ''
      let res = app.validateNodeUri(uri)
      expect(res).to.be.null
      done()
    })
    it('should return null with bad protocol', done => {
      let uri = 'httpppp://65.100.100.1'
      let res = app.validateNodeUri(uri)
      expect(res).to.be.null
      done()
    })
    it('should return null with missing protocol', done => {
      let uri = '65.100.100.1'
      let res = app.validateNodeUri(uri)
      expect(res).to.be.null
      done()
    })
    it('should return null with blacklisted IP', done => {
      let uri = '0.0.0.0'
      let res = app.validateNodeUri(uri)
      expect(res).to.be.null
      done()
    })
    it('should return null with non-IP host', done => {
      let uri = 'http://www.mynode.com'
      let res = app.validateNodeUri(uri)
      expect(res).to.be.null
      done()
    })
    it('should throw error with private IP', done => {
      let uri = 'http://10.0.0.1'
      expect(() => {
        app.validateNodeUri(uri)
      }).to.throw(`RFC1918 Private IP Addresses like "10.0.0.1" cannot be specified as CHAINPOINT_NODE_PUBLIC_URI`)
      done()
    })
    it('should throw error with unsupported port', done => {
      let uri = 'http://65.100.100.1:8080'
      expect(() => {
        app.validateNodeUri(uri)
      }).to.throw('CHAINPOINT_NODE_PUBLIC_URI only supports the use of port 80')
      done()
    })
    it('should return valid noreUri with no port specified', done => {
      let uri = 'http://65.100.100.1'
      let res = app.validateNodeUri(uri)
      expect(res).to.equal(uri)
      done()
    })
    it('should return valid noreUri with port 80 specified', done => {
      let uri = 'http://65.100.100.1:80'
      let res = app.validateNodeUri(uri)
      expect(res).to.equal(uri)
      done()
    })
  })
  describe('Validating private NodeURI', () => {
    it('should return null with empty URI', done => {
      let uri = ''
      let res = app.validateNodeUri(uri, true)
      expect(res).to.be.null
      done()
    })
    it('should return null with bad protocol', done => {
      let uri = 'httpppp://65.100.100.1'
      let res = app.validateNodeUri(uri, true)
      expect(res).to.be.null
      done()
    })
    it('should return null with missing protocol', done => {
      let uri = '65.100.100.1'
      let res = app.validateNodeUri(uri, true)
      expect(res).to.be.null
      done()
    })
    it('should return null with blacklisted IP', done => {
      let uri = '0.0.0.0'
      let res = app.validateNodeUri(uri, true)
      expect(res).to.be.null
      done()
    })
    it('should return null with non-IP host', done => {
      let uri = 'http://www.mynode.com'
      let res = app.validateNodeUri(uri, true)
      expect(res).to.be.null
      done()
    })
    it('should throw error with public IP', done => {
      let uri = 'http://65.100.100.1'
      expect(() => {
        app.validateNodeUri(uri, true)
      }).to.throw('CHAINPOINT_NODE_PRIVATE_URI must be a RFC1918 Private IP Addresses')
      done()
    })
    it('should throw error with unsupported port', done => {
      let uri = 'http://10.0.0.1:8080'
      expect(() => {
        app.validateNodeUri(uri, true)
      }).to.throw('CHAINPOINT_NODE_PUBLIC_URI only supports the use of port 80')
      done()
    })
    it('should return valid noreUri with no port specified', done => {
      let uri = 'http://10.0.0.1'
      let res = app.validateNodeUri(uri, true)
      expect(res).to.equal(uri)
      done()
    })
    it('should return valid noreUri with port 80 specified', done => {
      let uri = 'http://10.0.0.1:80'
      let res = app.validateNodeUri(uri, true)
      expect(res).to.equal(uri)
      done()
    })
  })
  describe('Validating reflected URI', () => {
    it('should throw error with invalid CHAINPOINT_NODE_REFLECTED_URI', done => {
      let val = 'nonsense'
      expect(() => {
        app.validateReflectedUri(val)
      }).to.throw('CHAINPOINT_NODE_REFLECTED_URI only accepts a value of "public" or "private"')
      done()
    })
    it('should throw error with no valid CHAINPOINT_NODE_PUBLIC_URI or CHAINPOINT_NODE_PRIVATE_URI, nothing set', done => {
      let val = 'public'
      expect(() => {
        app.validateReflectedUri(val)
      }).to.throw(
        'CHAINPOINT_NODE_REFLECTED_URI requires that a valid value be set for "CHAINPOINT_NODE_PUBLIC_URI" or "CHAINPOINT_NODE_PRIVATE_URI"'
      )
      done()
    })
    it('should throw error with no valid CHAINPOINT_NODE_PUBLIC_URI or CHAINPOINT_NODE_PRIVATE_URI, empties set', done => {
      let val = 'public'
      expect(() => {
        process.env.CHAINPOINT_NODE_PUBLIC_URI = 'http://0.0.0.0'
        process.env.CHAINPOINT_NODE_PRIVATE_URI = 'empty'
        app.validateReflectedUri(val)
      }).to.throw(
        'CHAINPOINT_NODE_REFLECTED_URI requires that a valid value be set for "CHAINPOINT_NODE_PUBLIC_URI" or "CHAINPOINT_NODE_PRIVATE_URI"'
      )
      done()
    })
    it('should throw error with empty CHAINPOINT_NODE_PUBLIC_URI when val = public', done => {
      let val = 'public'
      expect(() => {
        process.env.CHAINPOINT_NODE_PUBLIC_URI = 'empty'
        app.validateReflectedUri(val)
      }).to.throw(`CHAINPOINT_NODE_PUBLIC_URI is required as it has been set as the CHAINPOINT_NODE_REFLECTED_URI`)
      done()
    })
    it('should throw error with 0.0.0.0 CHAINPOINT_NODE_PUBLIC_URI when val = public', done => {
      let val = 'public'
      expect(() => {
        process.env.CHAINPOINT_NODE_PUBLIC_URI = 'http://0.0.0.0'
        process.env.CHAINPOINT_NODE_PRIVATE_URI = 'http://10.0.0.1'
        app.validateReflectedUri(val)
      }).to.throw(`CHAINPOINT_NODE_PUBLIC_URI is required as it has been set as the CHAINPOINT_NODE_REFLECTED_URI`)
      done()
    })
    it('should throw error with empty CHAINPOINT_NODE_PRIVATE_URI when val = private', done => {
      let val = 'private'
      expect(() => {
        process.env.CHAINPOINT_NODE_PUBLIC_URI = 'http://65.1.1.1'
        process.env.CHAINPOINT_NODE_PRIVATE_URI = 'empty'
        app.validateReflectedUri(val)
      }).to.throw(`CHAINPOINT_NODE_PRIVATE_URI is required as it has been set as the CHAINPOINT_NODE_REFLECTED_URI`)
      done()
    })
    it('should throw error with 0.0.0.0 CHAINPOINT_NODE_PRIVATE_URI when val = private', done => {
      let val = 'private'
      expect(() => {
        process.env.CHAINPOINT_NODE_PRIVATE_URI = 'http://0.0.0.0'
        app.validateReflectedUri(val)
      }).to.throw(`CHAINPOINT_NODE_PRIVATE_URI is required as it has been set as the CHAINPOINT_NODE_REFLECTED_URI`)
      done()
    })
    it('should not throw error with valid CHAINPOINT_NODE_PUBLIC_URI when val = public', done => {
      let val = 'public'
      process.env.CHAINPOINT_NODE_PUBLIC_URI = 'http://65.100.100.1'
      app.validateReflectedUri(val)
      done()
    })
    it('should not throw error with valid CHAINPOINT_NODE_PRIVATE_URI when val = private', done => {
      let val = 'private'
      process.env.CHAINPOINT_NODE_PRIVATE_URI = 'http://10.0.0.1'
      app.validateReflectedUri(val)
      done()
    })
  })
})
