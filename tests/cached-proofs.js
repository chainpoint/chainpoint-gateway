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

  describe('getCachedCoreProofsAsync with unknown hash_ids', () => {
    let hashId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let hashId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, hashIdCore: hashId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, hashIdCore: hashId2 }]
    }
    before(() => {
      cachedProofs.setCoreProofCache({})
      cachedProofs.setCores({
        getProofsAsync: () => [{ hash_id: hashId1, proof: null }, { hash_id: hashId2, proof: null }]
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
      expect(cache).to.deep.equal({})
    })
  })

  describe('getCachedCoreProofsAsync with valid, cached hash_ids', () => {
    let in15Minutes = Date.now() + 15 * 60 * 1000
    let hashId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let hashId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, hashIdCore: hashId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, hashIdCore: hashId2 }]
    }
    let proofObj1 = JSON.parse(fs.readFileSync('./tests/sample-data/core-cal-proof.chp.json'))
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof.chp.json'))
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

  describe('getCachedCoreProofsAsync with valid, non-cached hash_ids', () => {
    let hashId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let hashId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, hashIdCore: hashId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, hashIdCore: hashId2 }]
    }
    let proofObj1 = JSON.parse(fs.readFileSync('./tests/sample-data/core-cal-proof.chp.json'))
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof.chp.json'))
    before(() => {
      cachedProofs.setCoreProofCache({})
      cachedProofs.setCores({
        getProofsAsync: () => [{ hash_id: hashId1, proof: proofObj1 }, { hash_id: hashId2, proof: proofObj2 }]
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

  describe('getCachedCoreProofsAsync with valid, cached and non-cached hash_ids', () => {
    let in15Minutes = Date.now() + 15 * 60 * 1000
    let hashId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let hashId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, hashIdCore: hashId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, hashIdCore: hashId2 }]
    }
    let proofObj1 = JSON.parse(fs.readFileSync('./tests/sample-data/core-cal-proof.chp.json'))
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof.chp.json'))
    let cacheContents = {
      [submitId2]: { coreProof: proofObj2, expiresAt: in15Minutes }
    }
    before(() => {
      cachedProofs.setCoreProofCache(cacheContents)
      cachedProofs.setCores({
        getProofsAsync: () => [{ hash_id: hashId1, proof: proofObj1 }]
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
      expect(cache[submitId2].expiresAt).to.equal(in15Minutes)
    })
  })

  describe('getCachedCoreProofsAsync with mixed, cached and unknown hash_ids', () => {
    let in15Minutes = Date.now() + 15 * 60 * 1000
    let hashId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let hashId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, hashIdCore: hashId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, hashIdCore: hashId2 }]
    }
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof.chp.json'))
    let cacheContents = {
      [submitId2]: { coreProof: proofObj2, expiresAt: in15Minutes }
    }
    before(() => {
      cachedProofs.setCoreProofCache(cacheContents)
      cachedProofs.setCores({
        getProofsAsync: () => [{ hash_id: hashId1, proof: null }]
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

  describe('getCachedCoreProofsAsync with mixed, non-cached and unknown hash_ids', () => {
    let hashId1 = '66a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let hashId2 = '66bd6380-f4e7-11e7-895d-0176dc2220aa'
    let submitId1 = '77a34bd0-f4e7-11e7-a52b-016a36a9d789'
    let submitId2 = '77bd6380-f4e7-11e7-895d-0176dc2220aa'
    let ip = '65.1.1.1'
    let submission1 = {
      submitId: submitId1,
      cores: [{ ip: ip, hashIdCore: hashId1 }]
    }
    let submission2 = {
      submitId: submitId2,
      cores: [{ ip: ip, hashIdCore: hashId2 }]
    }
    let proofObj2 = JSON.parse(fs.readFileSync('./tests/sample-data/core-btc-proof.chp.json'))
    before(() => {
      cachedProofs.setCoreProofCache({})
      cachedProofs.setCores({
        getProofsAsync: () => [{ hash_id: hashId1, proof: null }, { hash_id: hashId2, proof: proofObj2 }]
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
      expect(cache[submitId2]).to.have.property('expiresAt')
      expect(cache[submitId2].expiresAt)
        .to.be.a('number')
        .and.to.be.greaterThan(Date.now() + 24 * 60 * 60 * 1000)
        .and.to.be.lessThan(Date.now() + 26 * 60 * 60 * 1000)
    })
  })
})
