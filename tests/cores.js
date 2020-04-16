/* global describe, it, before, beforeEach, afterEach */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect
const { Lsat } = require('lsat-js')

const cores = require('../lib/cores.js')
const data = require('./sample-data/lsat-data.json')

describe('Cores Methods', function() {
  this.timeout(5000)

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
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1', '65.1.1.2'], NETWORK: 'testnet' })
      cores.setRP(async () => {
        throw new Error('Intentional error')
      })
      cores.clearEPC()
    })
    it('should not connect and throw error with IP list and Bad IP', async () => {
      let errResult = null
      try {
        await cores.connectAsync()
      } catch (err) {
        errResult = err.message
      }
      expect(errResult).to.equal(`Unable to connect to 2 Core(s) as required`)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(0)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'], NETWORK: 'testnet' })
      cores.setRP(async () => {
        return { body: { network: 'testnet', sync_info: { catching_up: true }, uris: ['uri'] } }
      })
      cores.clearEPC()
    })
    it('should not connect and throw error with IP list and non-synced Core', async () => {
      let errResult = null
      try {
        await cores.connectAsync()
      } catch (err) {
        errResult = err.message
      }
      expect(errResult).to.equal(`Unable to connect to 1 Core(s) as required`)
      let connectedIPs = cores.getCoreConnectedIPs()
      expect(connectedIPs.length).to.equal(0)
    })
  })

  describe('connectAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'], NETWORK: 'testnet' })
      cores.setRP(async () => {
        return { body: { network: 'testnet', sync_info: { catching_up: false }, uris: ['uri'] } }
      })
      cores.clearEPC()
    })
    it('should connect with IP list and synced Core, sufficient count 1', async () => {
      let coreConnectionCount = 1
      cores.setCoreConnectionCount(coreConnectionCount)
      let errResult = null
      try {
        await cores.connectAsync()
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
      cores.setENV({
        CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1', '65.2.2.2', '65.3.3.3'],
        NETWORK: 'testnet'
      })
      cores.setRP(async () => {
        return {
          body: { network: 'testnet', sync_info: { catching_up: false }, uris: ['uri'] }
        }
      })
      cores.clearEPC()
    })
    it('should connect with IP list, sufficient count 3', async () => {
      let errResult = null
      try {
        await cores.connectAsync()
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
      cores.setENV({
        CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'],
        NETWORK: 'testnet'
      })
      cores.setRP(async o => {
        options = o
        return { body: { network: 'testnet', sync_info: { catching_up: false }, uris: ['uri'] } }
      })
      cores.clearEPC()
    })
    it('should use proper headers on Core requests', async () => {
      let coreConnectionCount = 1
      cores.setCoreConnectionCount(coreConnectionCount)
      await cores.connectAsync()
      expect(options).to.be.a('object')
      expect(options).to.have.property('headers')
    })
  })

  describe('parse402Response', () => {
    let lsat, challenge, response
    before(() => {
      challenge = data.challenge1000
      lsat = Lsat.fromChallenge(challenge)
      response = {
        statusCode: 402,
        headers: {
          'www-authenticate': challenge
        }
      }
    })

    it('should throw if no LSAT challenge present in response or not a 402', () => {
      const parseWrongStatusCode = () => cores.parse402Response({ ...response, statusCode: 401 })
      const parseMissingHeader = () => cores.parse402Response({ statusCode: 402 })
      expect(parseWrongStatusCode).to.throw()
      expect(parseMissingHeader).to.throw()
    })

    it('should should return an LSAT with invoice information', () => {
      const lsatFromResponse = cores.parse402Response(response)
      expect(lsatFromResponse.invoice).to.exist
      expect(lsatFromResponse.invoice).to.equal(lsat.invoice)
    })
  })

  describe('submitHashAsync', () => {
    let challengeResponse, env, coreList

    beforeEach(() => {
      coreList = ['65.1.1.1', '65.2.2.2', '65.3.3.3']
      env = { MAX_SATOSHI_PER_HASH: 10, CHAINPOINT_CORE_CONNECT_IP_LIST: [coreList[0]] }
      cores.setENV(env)
      cores.setLN({
        callMethodAsync: async (s, m) => {
          if (m === 'sendPayment') return { on: () => null, end: () => null, write: () => {} }
          return {}
        }
      })
      challengeResponse = {
        statusCode: 402,
        response: {
          statusCode: 402,
          headers: {
            'www-authenticate': data.challenge10
          },
          body: {
            error: {
              message: 'Payment Required.'
            }
          }
        }
      }
    })

    afterEach(() => {
      cores.setENV({})
      cores.setLN({})
      cores.setRP(() => {})
    })

    it('should return [] on 1 of 1 invoice amount to high failure', async () => {
      cores.setENV({ ...env, MAX_SATOSHI_PER_HASH: 5 })
      cores.setRP(async () => {
        throw challengeResponse
      })
      let result = await cores.submitHashAsync('deadbeefcafe')
      expect(result).to.be.a('array')
      expect(result.length).to.equal(0)
    })

    it('should return [] on 1 of 1 submit failure', async () => {
      let counter = 0
      cores.setRP(async () => {
        if (++counter === 1) throw 'Bad Submit'
        throw challengeResponse
      })
      let result = await cores.submitHashAsync('deadbeefcafe')
      expect(result).to.be.a('array')
      expect(result.length).to.equal(0)
    })

    it('should succeed on 1 of 1 item submitted', async () => {
      cores.setRP(options => {
        if (options.headers['Authorization']) return { body: 'ok' }
        throw challengeResponse
      })

      let result = await cores.submitHashAsync('deadbeefcafe')
      expect(result).to.be.a('array')
      expect(result.length).to.equal(1)
      expect(result[0]).to.be.a('object')
      expect(result[0]).to.have.property('ip')
      expect(result[0].ip).to.equal('65.1.1.1')
      expect(result[0]).to.have.property('response')
      expect(result[0].response).to.equal('ok')
    })

    it('should succeed on 2 of 3 item submitted, one bad IP', async () => {
      cores.setRP(async options => {
        if (options.uri.includes(coreList[1])) throw 'Bad IP!'
        if (options.headers['Authorization']) return { body: 'ok' }
        throw challengeResponse
      })
      cores.setENV({
        ...env,
        CHAINPOINT_CORE_CONNECT_IP_LIST: coreList
      })

      let result = await cores.submitHashAsync('deadbeefcafe')
      expect(result).to.be.a('array')
      expect(result.length).to.equal(2)
      expect(result[0]).to.be.a('object')
      expect(result[0]).to.have.property('ip')
      expect(result[0].ip).to.equal(coreList[0])
      expect(result[0]).to.have.property('response')
      expect(result[0].response).to.equal('ok')
      expect(result[1]).to.be.a('object')
      expect(result[1]).to.have.property('ip')
      expect(result[1].ip).to.equal(coreList[2])
      expect(result[1]).to.have.property('response')
      expect(result[1].response).to.equal('ok')
    })

    it('should succeed on 2 of 3 item submitted, one invoice amount too high', async () => {
      cores.setENV({
        ...env,
        CHAINPOINT_CORE_CONNECT_IP_LIST: coreList
      })
      cores.setRP(async options => {
        if (options.uri.includes(coreList[1])) {
          let response = {
            statusCode: 402,
            response: {
              statusCode: 402,
              headers: {
                'www-authenticate': data.challenge1000
              },
              body: {
                error: {
                  message: 'Payment Required.'
                }
              }
            }
          }
          throw response
        }
        if (options.headers['Authorization']) return { body: 'ok' }
        throw challengeResponse
      })
      let result = await cores.submitHashAsync('deadbeefcafe')
      expect(result).to.be.a('array')
      expect(result.length).to.equal(2)
      expect(result[0]).to.be.a('object')
      expect(result[0]).to.have.property('ip')
      expect(result[0].ip).to.equal(coreList[0])
      expect(result[0]).to.have.property('response')
      expect(result[0].response).to.equal('ok')
      expect(result[1]).to.be.a('object')
      expect(result[1]).to.have.property('ip')
      expect(result[1].ip).to.equal(coreList[2])
      expect(result[1]).to.have.property('response')
      expect(result[1].response).to.equal('ok')
    })

    it('should succeed on 3 of 3 item submitted', async () => {
      cores.setENV({
        ...env,
        CHAINPOINT_CORE_CONNECT_IP_LIST: coreList
      })
      cores.setRP(async options => {
        if (options.headers['Authorization']) return { body: 'ok' }
        throw challengeResponse
      })
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
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
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
      expect(errResponse.message).to.equal('Invalid response on GET proof : 500 : Bad IP!!!!!')
    })
  })

  describe('getProofsAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
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
      expect(errResponse.message).to.equal('Invalid response received on GET proof : Error!')
    })
  })

  describe('getProofsAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
      cores.setRP(async () => {
        return { body: 'ok' }
      })
    })
    it('should return success', async () => {
      let response = await cores.getProofsAsync('', [])
      expect(response).to.equal('ok')
    })
  })

  describe('getLatestCalBlockInfoAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
      cores.setRP(async () => {
        throw { message: 'Bad IP!!!!!', statusCode: 500 }
      })
    })
    it('should throw error with status code', async () => {
      let errResponse = null
      try {
        await cores.getLatestCalBlockInfoAsync()
      } catch (err) {
        errResponse = err
      }
      expect(errResponse.message).to.equal('Invalid response on GET status : 500')
    })
  })

  describe('getLatestCalBlockInfoAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
      cores.setRP(async () => {
        throw 'Error!'
      })
    })
    it('should throw error no status code', async () => {
      let errResponse = null
      try {
        await cores.getLatestCalBlockInfoAsync()
      } catch (err) {
        errResponse = err
      }
      expect(errResponse.message).to.equal('Invalid response received on GET status')
    })
  })

  describe('getLatestCalBlockInfoAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
      cores.setRP(async () => {
        return { body: { sync_info: { catching_up: false } } }
      })
    })
    it('should return success with one good IP', async () => {
      let response = await cores.getLatestCalBlockInfoAsync()
      expect(response).to.be.a('object')
      expect(response).to.have.property('catching_up')
      expect(response.catching_up).to.equal(false)
    })
  })

  describe('getLatestCalBlockInfoAsync', () => {
    let attempts = 0
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1', '65.1.1.2'] })
      cores.setRP(async () => {
        attempts++
        if (attempts > 1) return { body: { sync_info: { catching_up: false } } }
        throw 'Error!'
      })
    })
    it('should return success with one bad and one good IP', async () => {
      let response = await cores.getLatestCalBlockInfoAsync()
      expect(response).to.be.a('object')
      expect(response).to.have.property('catching_up')
      expect(response.catching_up).to.equal(false)
    })
  })

  describe('getLatestCalBlockInfoAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
      cores.setRP(async () => {
        return { body: { catching_up: true } }
      })
    })
    it('should throw error no status code when not synced', async () => {
      let errResponse = null
      try {
        await cores.getLatestCalBlockInfoAsync()
      } catch (err) {
        errResponse = err
      }
      expect(errResponse.message).to.equal('Invalid response received on GET status')
    })
  })

  describe('getLatestCalBlockInfoAsync', () => {
    let attempts = 0
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1', '65.1.1.2'] })
      cores.setRP(async () => {
        attempts++
        if (attempts > 1) return { body: { sync_info: { catching_up: false } } }
        return { body: { sync_info: { catching_up: false } } }
      })
    })
    it('should return success with one unsynced and one good IP', async () => {
      let response = await cores.getLatestCalBlockInfoAsync()
      expect(response).to.be.a('object')
      expect(response).to.have.property('catching_up')
      expect(response.catching_up).to.equal(false)
    })
  })

  describe('getCachedTransactionAsync', () => {
    before(() => {
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
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
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
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
      cores.setENV({ CHAINPOINT_CORE_CONNECT_IP_LIST: ['65.1.1.1'] })
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
