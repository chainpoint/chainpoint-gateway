/* global describe, it, before */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const cores = require('../lib/cores.js')

const { version } = require('../package.json')

describe('Cores Methods', () => {
  describe('startPruneExpiredItemsInterval', () => {
    it('should initiate interval as expected', async () => {
      let interval = cores.startPruneExpiredItemsInterval()
      expect(interval).to.be.a('object')
      clearInterval(interval)
    })
  })

  describe('getPruneExpiredIntervalSeconds', () => {
    it('should return expected value', async () => {
      let seconds = cores.getPruneExpiredIntervalSeconds()
      expect(seconds)
        .to.be.a('number')
        .and.to.equal(10)
    })
  })

  describe('pruneExpiredItems', () => {
    it('should prune no entries with all new items', done => {
      let in15Minutes = Date.now() + 15 * 60 * 1000
      cores.setCoreTxCache({
        '1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b': { expiresAt: in15Minutes },
        '28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257': { expiresAt: in15Minutes }
      })
      let cache = cores.getCoreTxCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      expect(cache).to.have.property('28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257')
      expect(cache['28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      cores.pruneExpiredItems()
      cache = cores.getCoreTxCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      expect(cache).to.have.property('28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257')
      expect(cache['28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      done()
    })

    it('should prune one of two entries with new and old items', done => {
      let in15Minutes = Date.now() + 15 * 60 * 1000
      let ago15Minutes = Date.now() - 15 * 60 * 1000
      cores.setCoreTxCache({
        '1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b': { expiresAt: in15Minutes },
        '28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257': { expiresAt: ago15Minutes }
      })
      let cache = cores.getCoreTxCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      expect(cache).to.have.property('28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257')
      expect(cache['28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257'].expiresAt)
        .to.be.a('number')
        .and.to.equal(ago15Minutes)
      cores.pruneExpiredItems()
      cache = cores.getCoreTxCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      expect(cache).to.not.have.property('28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257')
      done()
    })

    it('should prune all entries with old items', done => {
      let ago15Minutes = Date.now() - 15 * 60 * 1000
      cores.setCoreTxCache({
        '1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b': { expiresAt: ago15Minutes },
        '28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257': { expiresAt: ago15Minutes }
      })
      let cache = cores.getCoreTxCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b'].expiresAt)
        .to.be.a('number')
        .and.to.equal(ago15Minutes)
      expect(cache).to.have.property('28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257')
      expect(cache['28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257'].expiresAt)
        .to.be.a('number')
        .and.to.equal(ago15Minutes)
      cores.pruneExpiredItems()
      cache = cores.getCoreTxCache()
      expect(cache).to.be.a('object')
      expect(cache).to.not.have.property('1b7930a6fc0fe36d31318cfd3ebaed550cf28eaef171b06067bfbc184d2f206b')
      expect(cache).to.not.have.property('28a928b2043db77e340b523547bf16cb4aa483f0645fe0a290ed1f20aab76257')
      done()
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: '65.1.1.1' })
      cores.setRP(async () => {
        throw 'Bad IP'
      })
    })
    it('should not connect and throw error with IP list and Bad IP', async () => {
      let coreConnectionCount = 2
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(`Unable to connect to ${coreConnectionCount} Core(s) as required`)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(0)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: '65.1.1.1' })
      cores.setRP(async () => {
        return { body: { sync_info: { catching_up: true } } }
      })
    })
    it('should not connect and throw error with IP list and non-synched Core', async () => {
      let coreConnectionCount = 2
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(`Unable to connect to ${coreConnectionCount} Core(s) as required`)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(0)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: '65.1.1.1' })
      cores.setRP(async () => {
        return { body: { sync_info: { catching_up: false } } }
      })
    })
    it('should not connectand throw error with IP list and synched Core, insufficient count', async () => {
      let coreConnectionCount = 2
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(`Unable to connect to ${coreConnectionCount} Core(s) as required`)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(1)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: '65.1.1.1' })
      cores.setRP(async () => {
        return { body: { sync_info: { catching_up: false } } }
      })
    })
    it('should connect with IP list and synched Core, sufficient count 1', async () => {
      let coreConnectionCount = 1
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(null)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(1)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: '65.1.1.1,65.2.2.2,65.3.3.3' })
      let counter = 1
      cores.setRP(async () => {
        return { body: { sync_info: { catching_up: counter++ % 2 ? false : true } } }
      })
    })
    it('should connect with IP list and mixed-synched Core, sufficient count 2', async () => {
      let coreConnectionCount = 2
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(null)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(2)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: '65.1.1.1,65.2.2.2,65.3.3.3' })
      cores.setRP(async () => {
        return { body: { sync_info: { catching_up: false } } }
      })
    })
    it('should connect with IP list and synched Core, sufficient count 3', async () => {
      let coreConnectionCount = 3
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(null)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(3)
    })
  })

  describe('connectAsync', () => {
    let options = null
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: '65.1.1.1', NODE_TNT_ADDRESS: 'addr' })
      cores.setRP(async o => {
        options = o
        return { body: { sync_info: { catching_up: false } } }
      })
    })
    it('should use proper headers on Core requests', async () => {
      let coreConnectionCount = 1
      await cores.connectAsync(coreConnectionCount)
      expect(options).to.be.a('object')
      expect(options).to.have.property('headers')
      expect(options.headers).to.have.property('X-Node-Version')
      expect(options.headers).to.have.property('X-Node-Address')
      expect(options.headers['X-Node-Version']).to.equal(version)
      expect(options.headers['X-Node-Address']).to.equal('addr')
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setRP(async () => {
        throw 'Bad IP'
      })
    })
    it('should not connect and throw error with Core discovery and bad discovery', async () => {
      let coreConnectionCount = 1
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(`Unable to connect to ${coreConnectionCount} Core(s) as required`)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(0)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setRP(async opts => {
        if (opts.uri.endsWith('peers')) return { body: [{ remote_ip: '65.1.1.1' }] }
        throw 'Bad IP'
      })
    })
    it('should not connect and throw error with Core discovery and bad IP returned', async () => {
      let coreConnectionCount = 1
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(`Unable to connect to ${coreConnectionCount} Core(s) as required`)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(0)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setRP(async opts => {
        if (opts.uri.endsWith('peers')) return { body: [{ remote_ip: '65.1.1.1' }] }
        return { body: { sync_info: { catching_up: true } } }
      })
    })
    it('should not connect and throw error with Core discovery and unsynched returned', async () => {
      let coreConnectionCount = 1
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(`Unable to connect to ${coreConnectionCount} Core(s) as required`)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(0)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setRP(async opts => {
        if (opts.uri.endsWith('peers')) return { body: [{ remote_ip: '65.1.1.1' }] }
        return { body: { sync_info: { catching_up: false } } }
      })
    })
    it('should connect with Core discovery and synched IP', async () => {
      let coreConnectionCount = 1
      let errResult = null
      try {
        await cores.connectAsync(coreConnectionCount)
      } catch (err) {
        errResult = err
      }
      expect(errResult).to.equal(null)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(1)
    })
  })

  describe('submitHashAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1'])
      cores.setRP(async () => {
        throw 'Bad IP!'
      })
    })
    it('should return [] on 1 of 1 item failure', async () => {
      let result = await cores.submitHashAsync('deadbeefcafe')
      expect(result).to.be.a('array')
      expect(result.length).to.equal(0)
    })
  })

  describe('submitHashAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1'])
      cores.setRP(async () => {
        return { body: 'ok' }
      })
    })
    it('should succeed on 1 of 1 item submitted', async () => {
      let result = await cores.submitHashAsync('deadbeefcafe')
      expect(result).to.be.a('array')
      expect(result.length).to.equal(1)
      expect(result[0]).to.be.a('object')
      expect(result[0]).to.have.property('ip')
      expect(result[0].ip).to.equal('65.1.1.1')
      expect(result[0]).to.have.property('response')
      expect(result[0].response).to.equal('ok')
    })
  })

  describe('submitHashAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1', '65.2.2.2', '65.3.3.3'])
      let counter = 1
      cores.setRP(async () => {
        if (counter++ % 2 === 0) throw 'Bad IP!'
        return { body: 'ok' }
      })
    })
    it('should succeed on 2 of 3 item submitted, one bad IP', async () => {
      let result = await cores.submitHashAsync('deadbeefcafe')
      expect(result).to.be.a('array')
      expect(result.length).to.equal(2)
      expect(result[0]).to.be.a('object')
      expect(result[0]).to.have.property('ip')
      expect(result[0].ip).to.equal('65.1.1.1')
      expect(result[0]).to.have.property('response')
      expect(result[0].response).to.equal('ok')
      expect(result[1]).to.be.a('object')
      expect(result[1]).to.have.property('ip')
      expect(result[1].ip).to.equal('65.3.3.3')
      expect(result[1]).to.have.property('response')
      expect(result[1].response).to.equal('ok')
    })
  })

  describe('submitHashAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1', '65.2.2.2', '65.3.3.3'])
      cores.setRP(async () => {
        return { body: 'ok' }
      })
    })
    it('should succeed on 3 of 3 item submitted', async () => {
      let result = await cores.submitHashAsync('deadbeefcafe')
      expect(result).to.be.a('array')
      expect(result.length).to.equal(3)
      expect(result[0]).to.be.a('object')
      expect(result[0]).to.have.property('ip')
      expect(result[0].ip).to.equal('65.1.1.1')
      expect(result[0]).to.have.property('response')
      expect(result[0].response).to.equal('ok')
      expect(result[1]).to.be.a('object')
      expect(result[1]).to.have.property('ip')
      expect(result[1].ip).to.equal('65.2.2.2')
      expect(result[1]).to.have.property('response')
      expect(result[1].response).to.equal('ok')
      expect(result[2]).to.be.a('object')
      expect(result[2]).to.have.property('ip')
      expect(result[2].ip).to.equal('65.3.3.3')
      expect(result[2]).to.have.property('response')
      expect(result[2].response).to.equal('ok')
    })
  })

  describe('getProofsAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1'])
      cores.setRP(async () => {
        throw { message: 'Bad IP!!!!!', statusCode: 500 }
      })
    })
    it('should throw error with status code', async () => {
      let errResponse = null
      try {
        await cores.getProofsAsync('', [])
      } catch (err) {
        errResponse = err
      }
      expect(errResponse.message).to.equal('Invalid response on GET proof : 500')
    })
  })

  describe('getProofsAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1'])
      cores.setRP(async () => {
        throw 'Error!'
      })
    })
    it('should throw error no status code', async () => {
      let errResponse = null
      try {
        await cores.getProofsAsync('', [])
      } catch (err) {
        errResponse = err
      }
      expect(errResponse.message).to.equal('Invalid response received on GET proof')
    })
  })

  describe('getProofsAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1'])
      cores.setRP(async () => {
        return { body: 'ok' }
      })
    })
    it('should return success', async () => {
      let response = await cores.getProofsAsync('', [])
      expect(response).to.equal('ok')
    })
  })

  describe('getCachedTransactionAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1'])
      cores.setCoreTxCache({ a: { transaction: '1' } })
      cores.setRP(async () => {
        throw 'Dont call!'
      })
    })
    it('should return value from cache', async () => {
      let response = await cores.getCachedTransactionAsync('a')
      expect(response).to.equal('1')
    })
  })

  describe('getCachedTransactionAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1'])
      cores.setCoreTxCache({})
      cores.setRP(async () => {
        throw 'Bad IP!'
      })
    })
    it('should return null from bad IPs, no cache', async () => {
      let response = await cores.getCachedTransactionAsync('a')
      let cacheResult = cores.getCoreTxCache()
      expect(response).to.equal(null)
      expect(cacheResult).to.deep.equal({})
    })
  })

  describe('getCachedTransactionAsync', () => {
    before(() => {
      cores.setCoreConnectedIPs(['65.1.1.1'])
      cores.setCoreTxCache({})
      cores.setRP(async () => {
        return { body: 'result' }
      })
    })
    it('should return new tx and add to cache', async () => {
      let response = await cores.getCachedTransactionAsync('a')
      let cacheResult = cores.getCoreTxCache()
      expect(response).to.equal('result')
      expect(cacheResult).to.be.a('object')
      expect(cacheResult).to.have.property('a')
      expect(cacheResult.a).to.be.a('object')
      expect(cacheResult.a).to.have.property('transaction')
      expect(cacheResult.a.transaction).to.equal('result')
      expect(cacheResult.a).to.have.property('expiresAt')
      expect(cacheResult.a.expiresAt).to.be.a('number')
    })
  })
})
