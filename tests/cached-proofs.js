/* global describe, it, before */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const fs = require('fs')
const cachedProofs = require('../lib/cached-proofs.js')

describe('Cached Proofs Methods', () => {
  describe('startPruneExpiredItemsInterval', () => {
    it('should initiate interval as expected', async () => {
      let interval = cachedProofs.startPruneExpiredItemsInterval()
      expect(interval).to.be.a('object')
      clearInterval(interval)
    })
  })

  describe('getPruneExpiredIntervalSeconds', () => {
    it('should return expected value', async () => {
      let seconds = cachedProofs.getPruneExpiredIntervalSeconds()
      expect(seconds)
        .to.be.a('number')
        .and.to.equal(10)
    })
  })

  describe('pruneExpiredItems', () => {
    it('should prune no entries with all new items', done => {
      let in15Minutes = Date.now() + 15 * 60 * 1000
      cachedProofs.setCoreProofCache({
        '66a34bd0-f4e7-11e7-a52b-016a36a9d789': { expiresAt: in15Minutes },
        '66bd6380-f4e7-11e7-895d-0176dc2220aa': { expiresAt: in15Minutes }
      })
      let cache = cachedProofs.getCoreProofCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('66a34bd0-f4e7-11e7-a52b-016a36a9d789')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      expect(cache).to.have.property('66bd6380-f4e7-11e7-895d-0176dc2220aa')
      expect(cache['66bd6380-f4e7-11e7-895d-0176dc2220aa'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['66bd6380-f4e7-11e7-895d-0176dc2220aa'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      cachedProofs.pruneExpiredItems()
      cache = cachedProofs.getCoreProofCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('66a34bd0-f4e7-11e7-a52b-016a36a9d789')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      expect(cache).to.have.property('66bd6380-f4e7-11e7-895d-0176dc2220aa')
      expect(cache['66bd6380-f4e7-11e7-895d-0176dc2220aa'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['66bd6380-f4e7-11e7-895d-0176dc2220aa'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      done()
    })

    it('should prune one of two entries with new and old items', done => {
      let in15Minutes = Date.now() + 15 * 60 * 1000
      let ago15Minutes = Date.now() - 15 * 60 * 1000
      cachedProofs.setCoreProofCache({
        '66a34bd0-f4e7-11e7-a52b-016a36a9d789': { expiresAt: in15Minutes },
        '66bd6380-f4e7-11e7-895d-0176dc2220aa': { expiresAt: ago15Minutes }
      })
      let cache = cachedProofs.getCoreProofCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('66a34bd0-f4e7-11e7-a52b-016a36a9d789')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      expect(cache).to.have.property('66bd6380-f4e7-11e7-895d-0176dc2220aa')
      expect(cache['66bd6380-f4e7-11e7-895d-0176dc2220aa'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['66bd6380-f4e7-11e7-895d-0176dc2220aa'].expiresAt)
        .to.be.a('number')
        .and.to.equal(ago15Minutes)
      cachedProofs.pruneExpiredItems()
      cache = cachedProofs.getCoreProofCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('66a34bd0-f4e7-11e7-a52b-016a36a9d789')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'].expiresAt)
        .to.be.a('number')
        .and.to.equal(in15Minutes)
      expect(cache).to.not.have.property('66bd6380-f4e7-11e7-895d-0176dc2220aa')
      done()
    })

    it('should prune all entries with old items', done => {
      let ago15Minutes = Date.now() - 15 * 60 * 1000
      cachedProofs.setCoreProofCache({
        '66a34bd0-f4e7-11e7-a52b-016a36a9d789': { expiresAt: ago15Minutes },
        '66bd6380-f4e7-11e7-895d-0176dc2220aa': { expiresAt: ago15Minutes }
      })
      let cache = cachedProofs.getCoreProofCache()
      expect(cache).to.be.a('object')
      expect(cache).to.have.property('66a34bd0-f4e7-11e7-a52b-016a36a9d789')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['66a34bd0-f4e7-11e7-a52b-016a36a9d789'].expiresAt)
        .to.be.a('number')
        .and.to.equal(ago15Minutes)
      expect(cache).to.have.property('66bd6380-f4e7-11e7-895d-0176dc2220aa')
      expect(cache['66bd6380-f4e7-11e7-895d-0176dc2220aa'])
        .to.be.a('object')
        .and.to.have.property('expiresAt')
      expect(cache['66bd6380-f4e7-11e7-895d-0176dc2220aa'].expiresAt)
        .to.be.a('number')
        .and.to.equal(ago15Minutes)
      cachedProofs.pruneExpiredItems()
      cache = cachedProofs.getCoreProofCache()
      expect(cache).to.be.a('object')
      expect(cache).to.not.have.property('66a34bd0-f4e7-11e7-a52b-016a36a9d789')
      expect(cache).to.not.have.property('66bd6380-f4e7-11e7-895d-0176dc2220aa')
      done()
    })
  })

  describe('getCachedCoreProofsAsync with unknown proof_ids', () => {
    let proofId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, proofId: proofId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, proofId: proofId2 }]
    }
    before(() => {
      cachedProofs.setCoreProofCache({})
      cachedProofs.setCores({
        getProofsAsync: () => [{ proof_id: proofId1, proof: null }, { proof_id: proofId2, proof: null }]
      })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(2)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.equal(null)
      expect(results[0]).to.not.have.property('anchorsComplete')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.equal(null)
      expect(results[1]).to.not.have.property('anchorsComplete')
      expect(cache).to.be.a('object')
      expect(cache).to.have.property(submitId1)
      expect(cache[submitId1]).to.be.a('object')
      expect(cache[submitId1]).to.have.property('coreProof')
      expect(cache[submitId1].coreProof).to.equal(null)
      expect(cache[submitId1]).to.have.property('expiresAt')
      expect(cache[submitId1].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 0.9 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 1.5 * 60 * 1000)
      expect(cache).to.have.property(submitId2)
      expect(cache[submitId2]).to.be.a('object')
      expect(cache[submitId2]).to.have.property('coreProof')
      expect(cache[submitId2].coreProof).to.equal(null)
      expect(cache[submitId2]).to.have.property('expiresAt')
      expect(cache[submitId2].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 0.9 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 1.1 * 60 * 1000)
    })
  })

  describe('getCachedCoreProofsAsync with valid, cached proof_id  - mainnet', () => {
    let in15Minutes = Date.now() + 15 * 60 * 1000
    let proofId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, proofId: proofId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, proofId: proofId2 }]
    }
    let proofObj1 = JSON.parse(fs.readFileSync('./tests/sample-data/core-cal-proof-v4.chp.json'))
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof-v4.chp.json'))
    let cacheContents = {
      [submitId1]: { coreProof: proofObj1, expiresAt: in15Minutes },
      [submitId2]: { coreProof: proofObj2, expiresAt: in15Minutes }
    }
    before(() => {
      cachedProofs.setCoreProofCache(cacheContents)
      cachedProofs.setCores({
        getProofsAsync: () => {
          throw 'Do not call!'
        }
      })
      cachedProofs.setENV({ NETWORK: 'mainnet' })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(2)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj1)
      expect(results[0])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[0].anchorsComplete.length).to.equal(1)
      expect(results[0].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj2)
      expect(results[1])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[1].anchorsComplete.length).to.equal(2)
      expect(results[1].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1].anchorsComplete[1])
        .to.be.a('string')
        .and.to.equal('btc')
      expect(cache).to.be.a('object')
      expect(cache).to.deep.equal(cacheContents)
    })
  })

  describe('getCachedCoreProofsAsync with valid, cached proof_id  - testnet', () => {
    let in15Minutes = Date.now() + 15 * 60 * 1000
    let proofId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, proofId: proofId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, proofId: proofId2 }]
    }
    let proofObj1 = JSON.parse(fs.readFileSync('./tests/sample-data/core-tcal-proof-v4.chp.json'))
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-tbtc-proof-v4.chp.json'))
    let cacheContents = {
      [submitId1]: { coreProof: proofObj1, expiresAt: in15Minutes },
      [submitId2]: { coreProof: proofObj2, expiresAt: in15Minutes }
    }
    before(() => {
      cachedProofs.setCoreProofCache(cacheContents)
      cachedProofs.setCores({
        getProofsAsync: () => {
          throw 'Do not call!'
        }
      })
      cachedProofs.setENV({ NETWORK: 'testnet' })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(2)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj1)
      expect(results[0])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[0].anchorsComplete.length).to.equal(1)
      expect(results[0].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('tcal')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj2)
      expect(results[1])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[1].anchorsComplete.length).to.equal(2)
      expect(results[1].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('tcal')
      expect(results[1].anchorsComplete[1])
        .to.be.a('string')
        .and.to.equal('tbtc')
      expect(cache).to.be.a('object')
      expect(cache).to.deep.equal(cacheContents)
    })
  })

  describe('getCachedCoreProofsAsync with valid, non-cached proof_id', () => {
    let proofId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, proofId: proofId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, proofId: proofId2 }]
    }
    let proofObj1 = JSON.parse(fs.readFileSync('./tests/sample-data/core-cal-proof-v4.chp.json'))
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof-v4.chp.json'))
    before(() => {
      cachedProofs.setCoreProofCache({})
      cachedProofs.setCores({
        getProofsAsync: () => [{ proof_id: proofId1, proof: proofObj1 }, { proof_id: proofId2, proof: proofObj2 }]
      })
      cachedProofs.setENV({ NETWORK: 'mainnet' })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(2)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj1)
      expect(results[0])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[0].anchorsComplete.length).to.equal(1)
      expect(results[0].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj2)
      expect(results[1])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[1].anchorsComplete.length).to.equal(2)
      expect(results[1].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1].anchorsComplete[1])
        .to.be.a('string')
        .and.to.equal('btc')
      expect(cache).to.be.a('object')
      expect(cache).to.have.property(submitId1)
      expect(cache[submitId1]).to.be.a('object')
      expect(cache[submitId1]).to.have.property('coreProof')
      expect(cache[submitId1].coreProof).to.deep.equal(proofObj1)
      expect(cache[submitId1]).to.have.property('expiresAt')
      expect(cache[submitId1].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 14 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 16 * 60 * 1000)
      expect(cache).to.have.property(submitId2)
      expect(cache[submitId2]).to.be.a('object')
      expect(cache[submitId2]).to.have.property('coreProof')
      expect(cache[submitId2].coreProof).to.deep.equal(proofObj2)
      expect(cache[submitId2]).to.have.property('expiresAt')
      expect(cache[submitId2].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 24 * 60 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 26 * 60 * 60 * 1000)
    })
  })

  describe('getCachedCoreProofsAsync with valid, cached and non-cached proof_ids, cache a null result', () => {
    let in15Minutes = Date.now() + 15 * 60 * 100
    let proofId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let proofId3 = '66bd6380-f4e7-11e7-895d-0176dc2220ff'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId3 = '77bd6380-f4e7-11e7-895d-0176dc2220ff'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, proofId: proofId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, proofId: proofId2 }]
    }
    let submission3 = {
      submitId: submitId3,
      cores: [{ ip: ip, proofId: proofId3 }]
    }
    let proofObj1 = JSON.parse(fs.readFileSync('./tests/sample-data/core-cal-proof-v4.chp.json'))
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof-v4.chp.json'))
    let cacheContents = {
      [submitId2]: { coreProof: proofObj2, expiresAt: in15Minutes }
    }
    before(() => {
      cachedProofs.setCoreProofCache(cacheContents)
      cachedProofs.setCores({
        getProofsAsync: () => [{ proof_id: proofId1, proof: proofObj1 }, { proof_id: proofId3, proof: null }]
      })
      cachedProofs.setENV({ NETWORK: 'mainnet' })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2, submission3])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(3)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj1)
      expect(results[0])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[0].anchorsComplete.length).to.equal(1)
      expect(results[0].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj2)
      expect(results[1])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[1].anchorsComplete.length).to.equal(2)
      expect(results[1].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1].anchorsComplete[1])
        .to.be.a('string')
        .and.to.equal('btc')
      expect(results[2]).to.be.a('object')
      expect(results[2])
        .to.have.property('submitId')
        .and.to.equal(submitId3)
      expect(results[2])
        .to.have.property('proof')
        .and.to.equal(null)
      expect(cache).to.be.a('object')
      expect(cache).to.have.property(submitId1)
      expect(cache[submitId1]).to.be.a('object')
      expect(cache[submitId1]).to.have.property('coreProof')
      expect(cache[submitId1].coreProof).to.deep.equal(proofObj1)
      expect(cache[submitId1]).to.have.property('expiresAt')
      expect(cache[submitId1].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 14 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 16 * 60 * 1000)
      expect(cache).to.have.property(submitId2)
      expect(cache[submitId2]).to.be.a('object')
      expect(cache[submitId2]).to.have.property('coreProof')
      expect(cache[submitId2].coreProof).to.deep.equal(proofObj2)
      expect(cache[submitId2]).to.have.property('expiresAt')
      expect(cache[submitId2].expiresAt).to.equal(in15Minutes)
      expect(cache).to.have.property(submitId3)
      expect(cache[submitId3]).to.be.a('object')
      expect(cache[submitId3]).to.have.property('coreProof')
      expect(cache[submitId3].coreProof).to.equal(null)
      expect(cache[submitId3]).to.have.property('expiresAt')
      expect(cache[submitId3].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 0.9 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 1.1 * 60 * 1000)
    })
  })

  describe('getCachedCoreProofsAsync with mixed, cached and unknown proof_ids, cache a null result', () => {
    let in15Minutes = Date.now() + 15 * 60 * 1000
    let proofId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, proofId: proofId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, proofId: proofId2 }]
    }
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof-v4.chp.json'))
    let cacheContents = {
      [submitId2]: { coreProof: proofObj2, expiresAt: in15Minutes }
    }
    before(() => {
      cachedProofs.setCoreProofCache(cacheContents)
      cachedProofs.setCores({
        getProofsAsync: () => [{ proof_id: proofId1, proof: null }]
      })
      cachedProofs.setENV({ NETWORK: 'mainnet' })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(2)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.equal(null)
      expect(results[0]).to.not.have.property('anchorsComplete')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj2)
      expect(results[1])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[1].anchorsComplete.length).to.equal(2)
      expect(results[1].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1].anchorsComplete[1])
        .to.be.a('string')
        .and.to.equal('btc')
      expect(cache).to.be.a('object')
      expect(cache).to.have.property(submitId2)
      expect(cache[submitId2]).to.be.a('object')
      expect(cache[submitId2]).to.have.property('coreProof')
      expect(cache[submitId2].coreProof).to.deep.equal(proofObj2)
      expect(cache[submitId2]).to.have.property('expiresAt')
      expect(cache[submitId2].expiresAt).to.equal(in15Minutes)
      expect(cache).to.have.property(submitId1)
      expect(cache[submitId1]).to.be.a('object')
      expect(cache[submitId1]).to.have.property('coreProof')
      expect(cache[submitId1].coreProof).to.equal(null)
      expect(cache[submitId1]).to.have.property('expiresAt')
      expect(cache[submitId1].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 0.9 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 1.5 * 60 * 1000)
    })
  })

  describe('getCachedCoreProofsAsync with mixed, non-cached and unknown proof_ids', () => {
    let proofId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, proofId: proofId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, proofId: proofId2 }]
    }
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof-v4.chp.json'))
    before(() => {
      cachedProofs.setCoreProofCache({})
      cachedProofs.setCores({
        getProofsAsync: () => [{ proof_id: proofId1, proof: null }, { proof_id: proofId2, proof: proofObj2 }]
      })
      cachedProofs.setENV({ NETWORK: 'mainnet' })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(2)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.equal(null)
      expect(results[0]).to.not.have.property('anchorsComplete')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj2)
      expect(results[1])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[1].anchorsComplete.length).to.equal(2)
      expect(results[1].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1].anchorsComplete[1])
        .to.be.a('string')
        .and.to.equal('btc')
      expect(cache).to.be.a('object')
      expect(cache).to.have.property(submitId1)
      expect(cache[submitId1]).to.be.a('object')
      expect(cache[submitId1]).to.have.property('coreProof')
      expect(cache[submitId1].coreProof).to.equal(null)
      expect(cache[submitId1]).to.have.property('expiresAt')
      expect(cache[submitId1].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 0.9 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 1.1 * 60 * 60 * 1000)
      expect(cache).to.have.property(submitId2)
      expect(cache[submitId2]).to.be.a('object')
      expect(cache[submitId2]).to.have.property('coreProof')
      expect(cache[submitId2].coreProof).to.equal(proofObj2)
      expect(cache[submitId2]).to.have.property('expiresAt')
      expect(cache[submitId2].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 24 * 60 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 26 * 60 * 60 * 1000)
    })
  })

  describe('getCachedCoreProofsAsync with valid, non-cached proof_ids, first IP bad', () => {
    let proofId1a = '55a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId1b = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2a = '55bd6380-f4e7-11e7-895d-0176dc2220aa'
    let proofId2b = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip1 = '65.1.1.1'
    let ip2 = '65.2.2.2'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip1, proofId: proofId1a }, { ip: ip2, proofId: proofId1b }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip1, proofId: proofId2a }, { ip: ip2, proofId: proofId2b }]
    }
    let proofObj1 = JSON.parse(fs.readFileSync('./tests/sample-data/core-cal-proof-v4.chp.json'))
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof-v4.chp.json'))
    before(() => {
      cachedProofs.setCoreProofCache({})
      cachedProofs.setCores({
        getProofsAsync: ip => {
          if (ip === ip1) throw new Error('Bad IP')
          return [{ proof_id: proofId1b, proof: proofObj1 }, { proof_id: proofId2b, proof: proofObj2 }]
        }
      })
      cachedProofs.setENV({ NETWORK: 'mainnet' })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(2)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj1)
      expect(results[0])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[0].anchorsComplete.length).to.equal(1)
      expect(results[0].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj2)
      expect(results[1])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[1].anchorsComplete.length).to.equal(2)
      expect(results[1].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1].anchorsComplete[1])
        .to.be.a('string')
        .and.to.equal('btc')
      expect(cache).to.be.a('object')
      expect(cache).to.have.property(submitId1)
      expect(cache[submitId1]).to.be.a('object')
      expect(cache[submitId1]).to.have.property('coreProof')
      expect(cache[submitId1].coreProof).to.deep.equal(proofObj1)
      expect(cache[submitId1]).to.have.property('expiresAt')
      expect(cache[submitId1].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 14 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 16 * 60 * 1000)
      expect(cache).to.have.property(submitId2)
      expect(cache[submitId2]).to.be.a('object')
      expect(cache[submitId2]).to.have.property('coreProof')
      expect(cache[submitId2].coreProof).to.deep.equal(proofObj2)
      expect(cache[submitId2]).to.have.property('expiresAt')
      expect(cache[submitId2].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 24 * 60 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 26 * 60 * 60 * 1000)
    })
  })

  describe('getCachedCoreProofsAsync with valid, non-cached proof_ids, IP bad, different sub counts', () => {
    let proofId1a = '55a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2a = '55bd6380-f4e7-11e7-895d-0176dc2220aa'
    let proofId2b = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip1 = '65.1.1.1'
    let ip2 = '65.2.2.2'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip1, proofId: proofId1a }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip1, proofId: proofId2a }, { ip: ip2, proofId: proofId2b }]
    }
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof-v4.chp.json'))
    before(() => {
      cachedProofs.setCoreProofCache({})
      cachedProofs.setCores({
        getProofsAsync: ip => {
          if (ip === ip1) throw new Error('Bad IP')
          return [{ proof_id: proofId2b, proof: proofObj2 }]
        }
      })
      cachedProofs.setENV({ NETWORK: 'mainnet' })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(2)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.equal(null)
      expect(results[0]).to.not.have.property('anchorsComplete')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj2)
      expect(results[1])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[1].anchorsComplete.length).to.equal(2)
      expect(results[1].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1].anchorsComplete[1])
        .to.be.a('string')
        .and.to.equal('btc')
      expect(cache).to.be.a('object')
      expect(cache).to.not.have.property(submitId1)
      expect(cache).to.have.property(submitId2)
      expect(cache[submitId2]).to.be.a('object')
      expect(cache[submitId2]).to.have.property('coreProof')
      expect(cache[submitId2].coreProof).to.deep.equal(proofObj2)
      expect(cache[submitId2]).to.have.property('expiresAt')
      expect(cache[submitId2].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 24 * 60 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 26 * 60 * 60 * 1000)
    })
  })

  describe('getCachedCoreProofsAsync with valid, non-cached proof_ids, two IPs bad, different sub counts and IPs', () => {
    let proofId1a = '55a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId1b = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let proofId2a = '55bd6380-f4e7-11e7-895d-0176dc2220aa'
    let proofId2b = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let proofId2c = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '88a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '88bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip1a = '65.1.1.1'
    let ip1b = '65.2.2.2'
    let ip2a = '65.3.3.3'
    let ip2b = '65.4.4.4'
    let ip2c = '65.5.5.5'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip1a, proofId: proofId1a }, { ip: ip1b, proofId: proofId1b }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip2a, proofId: proofId2a }, { ip: ip2b, proofId: proofId2b }, { ip: ip2c, proofId: proofId2c }]
    }
    let proofObj1 = JSON.parse(fs.readFileSync('./tests/sample-data/core-cal-proof-v4.chp.json'))
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof-v4.chp.json'))
    before(() => {
      cachedProofs.setCoreProofCache({})
      cachedProofs.setCores({
        getProofsAsync: ip => {
          if (ip === ip1a || ip == ip2a || ip == ip2b) throw new Error('Bad IP')
          if (ip == ip1b) return [{ proof_id: proofId1b, proof: proofObj1 }]
          if (ip == ip2c) return [{ proof_id: proofId2c, proof: proofObj2 }]
        }
      })
      cachedProofs.setENV({ NETWORK: 'mainnet' })
    })
    it('should return expected value', async () => {
      let results = await cachedProofs.getCachedCoreProofsAsync([submission1, submission2])
      let cache = cachedProofs.getCoreProofCache()
      expect(results).to.be.a('array')
      expect(results.length).to.equal(2)
      expect(results[0]).to.be.a('object')
      expect(results[0])
        .to.have.property('submitId')
        .and.to.equal(submitId1)
      expect(results[0])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj1)
      expect(results[0])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[0].anchorsComplete.length).to.equal(1)
      expect(results[0].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1]).to.be.a('object')
      expect(results[1])
        .to.have.property('submitId')
        .and.to.equal(submitId2)
      expect(results[1])
        .to.have.property('proof')
        .and.to.deep.equal(proofObj2)
      expect(results[1])
        .to.have.property('anchorsComplete')
        .and.to.be.a('array')
      expect(results[1].anchorsComplete.length).to.equal(2)
      expect(results[1].anchorsComplete[0])
        .to.be.a('string')
        .and.to.equal('cal')
      expect(results[1].anchorsComplete[1])
        .to.be.a('string')
        .and.to.equal('btc')
      expect(cache).to.be.a('object')
      expect(cache).to.have.property(submitId1)
      expect(cache[submitId1]).to.be.a('object')
      expect(cache[submitId1]).to.have.property('coreProof')
      expect(cache[submitId1].coreProof).to.deep.equal(proofObj1)
      expect(cache[submitId1]).to.have.property('expiresAt')
      expect(cache[submitId1].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 14 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 16 * 60 * 1000)
      expect(cache).to.have.property(submitId2)
      expect(cache[submitId2]).to.be.a('object')
      expect(cache[submitId2]).to.have.property('coreProof')
      expect(cache[submitId2].coreProof).to.deep.equal(proofObj2)
      expect(cache[submitId2]).to.have.property('expiresAt')
      expect(cache[submitId2].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 24 * 60 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 26 * 60 * 60 * 1000)
    })
  })
})
