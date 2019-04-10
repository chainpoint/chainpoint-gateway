/* global describe, it, before, after */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const aggregator = require('../lib/aggregator.js')
const uuidv1 = require('uuid/v1')
const crypto = require('crypto')
const BLAKE2s = require('blake2s-js')
const MerkleTools = require('merkle-tools')

describe('Aggregator Methods', () => {
  describe('startAggInterval', () => {
    it('should initiate interval as expected', async () => {
      let interval = aggregator.startAggInterval()
      expect(interval).to.be.a('object')
      clearInterval(interval)
    })
  })

  describe('getAggIntervalSeconds', () => {
    it('should return expected value', async () => {
      let seconds = aggregator.getAggIntervalSeconds()
      expect(seconds)
        .to.be.a('number')
        .and.to.equal(60)
    })
  })

  describe('aggregateSubmitAndPersistAsync with 0 hashes', () => {
    let hashCount = 0
    let IncomingHashes = generateIncomingHashData(hashCount)
    let ProofStateData = []
    before(() => {
      aggregator.setRocksDB({
        getIncomingHashesUpToAsync: async () => {
          let delOps = IncomingHashes.map(item => {
            return { type: 'del', key: item.hash_id_node }
          })
          return [IncomingHashes, delOps]
        }
      })
    })
    after(() => {})
    it('should complete successfully', async () => {
      expect(IncomingHashes.length).to.equal(hashCount)
      await aggregator.aggregateSubmitAndPersistAsync()
      expect(IncomingHashes.length).to.equal(0)
      expect(ProofStateData.length).to.equal(hashCount)
    })
  })

  describe('aggregateSubmitAndPersistAsync with 100 hashes', () => {
    let hashCount = 100
    let IncomingHashes = generateIncomingHashData(hashCount)
    let newHashIdCore1 = null
    let newHashIdCore2 = null
    let ProofStateData = null
    let ip1 = '65.21.21.122'
    let ip2 = '65.21.21.123'
    before(() => {
      aggregator.setRocksDB({
        getIncomingHashesUpToAsync: async () => {
          let delOps = IncomingHashes.map(item => {
            return { type: 'del', key: item.hash_id_node }
          })
          return [IncomingHashes, delOps]
        },
        deleteBatchAsync: async delOps => {
          let delHashIds = delOps.map(item => item.key)
          IncomingHashes = IncomingHashes.filter(item => !delHashIds.includes(item.hash_id_node))
        },
        saveProofStatesBatchAsync: async items => {
          ProofStateData = items
        }
      })
      aggregator.setCores({
        submitHashAsync: async () => {
          let hash = crypto.randomBytes(32).toString('hex')
          newHashIdCore1 = generateBlakeEmbeddedUUID(hash)
          newHashIdCore2 = generateBlakeEmbeddedUUID(hash)
          return [
            { ip: ip1, response: { hash_id: newHashIdCore1, hash: hash, processing_hints: 'hints' } },
            { ip: ip2, response: { hash_id: newHashIdCore2, hash: hash, processing_hints: 'hints' } }
          ]
        }
      })
      aggregator.setEventMetrics({
        captureEvent: () => {}
      })
      aggregator.setUsageToken({
        getActiveUsageTokenAsync: () => 'tkn'
      })
    })
    after(() => {})
    it('should complete successfully', async () => {
      var merkleTools = new MerkleTools()
      expect(IncomingHashes.length).to.equal(hashCount)
      let aggRoot = await aggregator.aggregateSubmitAndPersistAsync()
      expect(IncomingHashes.length).to.equal(0)
      expect(ProofStateData.length).to.equal(hashCount)
      for (let x = 0; x < hashCount; x++) {
        expect(ProofStateData[x])
          .to.have.property('hashIdNode')
          .and.and.be.a('string')
        expect(ProofStateData[x])
          .to.have.property('hash')
          .and.and.be.a('string')
        expect(ProofStateData[x])
          .to.have.property('proofState')
          .and.and.be.a('array')
        // add the additional nodeId operation to get final leaf values
        let hashIdBuffer = Buffer.from(`node_id:${ProofStateData[x].hashIdNode}`, 'utf8')
        let hashBuffer = Buffer.from(ProofStateData[x].hash, 'hex')
        ProofStateData[x].hash = crypto
          .createHash('sha256')
          .update(Buffer.concat([hashIdBuffer, hashBuffer]))
          .digest()
        // convert from binary
        let proofState = []
        for (let y = 0; y < ProofStateData[x].proofState.length; y += 2) {
          let operand = ProofStateData[x].proofState[y + 1].toString('hex')
          let isLeft = ProofStateData[x].proofState[y].toString('hex') === '00'
          let fullOp
          if (isLeft) {
            fullOp = { left: operand }
          } else {
            fullOp = { right: operand }
          }
          proofState.push(fullOp)
        }
        expect(merkleTools.validateProof(proofState, ProofStateData[x].hash, aggRoot)).to.equal(true)
        expect(ProofStateData[x]).to.have.property('submission')
        expect(ProofStateData[x].submission).to.be.a('object')
        expect(ProofStateData[x].submission)
          .to.have.property('submitId')
          .and.and.be.a('string')
        expect(ProofStateData[x].submission).to.have.property('cores')
        expect(ProofStateData[x].submission.cores).to.to.a('array')
        expect(ProofStateData[x].submission.cores.length).to.equal(2)
        expect(ProofStateData[x].submission.cores[0]).to.be.a('object')
        expect(ProofStateData[x].submission.cores[0])
          .to.have.property('ip')
          .and.and.be.a('string')
          .and.to.equal(ip1)
        expect(ProofStateData[x].submission.cores[0])
          .to.have.property('hashIdCore')
          .and.and.be.a('string')
          .and.to.equal(newHashIdCore1)
        expect(ProofStateData[x].submission.cores[1]).to.be.a('object')
        expect(ProofStateData[x].submission.cores[1])
          .to.have.property('ip')
          .and.and.be.a('string')
          .and.to.equal(ip2)
        expect(ProofStateData[x].submission.cores[1])
          .to.have.property('hashIdCore')
          .and.and.be.a('string')
          .and.to.equal(newHashIdCore2)
      }
    })
  })
})

// support functions
function generateIncomingHashData(batchSize) {
  let hashes = []

  for (let x = 0; x < batchSize; x++) {
    let newHashIdNode = uuidv1()
    hashes.push({
      hash_id_node: newHashIdNode,
      hash: crypto.randomBytes(32).toString('hex')
    })
  }

  return hashes
}

function generateBlakeEmbeddedUUID(hash) {
  let timestampDate = new Date()
  let timestampMS = timestampDate.getTime()
  // 5 byte length BLAKE2s hash w/ personalization
  let h = new BLAKE2s(5, { personalization: Buffer.from('CHAINPNT') })
  let hashStr = [timestampMS.toString(), timestampMS.toString().length, hash, hash.length].join(':')

  h.update(Buffer.from(hashStr))

  return uuidv1({
    msecs: timestampMS,
    node: Buffer.concat([Buffer.from([0x01]), h.digest()])
  })
}
