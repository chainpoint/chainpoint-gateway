/* global describe, it, before, after */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const aggregator = require('../lib/aggregator.js')
const uuidv1 = require('uuid/v1')
const crypto = require('crypto')
const BLAKE2s = require('blake2s-js')
const MerkleTools = require('merkle-tools')

describe.only('Aggregator Methods', () => {
  describe('startAggInterval', () => {
    it('should initiate interval as expected', async () => {
      let interval = aggregator.startAggInterval()
      expect(interval).to.be.a('object')
      clearInterval(interval)
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
            return { type: 'del', key: item.proof_id }
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
    let newProofIdCore1 = null
    let newProofIdCore2 = null
    let ProofStateData = null
    let ip1 = '65.21.21.122'
    let ip2 = '65.21.21.123'
    before(() => {
      aggregator.setRocksDB({
        getIncomingHashesUpToAsync: async () => {
          let delOps = IncomingHashes.map(item => {
            return { type: 'del', key: item.proof_id }
          })
          return [IncomingHashes, delOps]
        },
        deleteBatchAsync: async delOps => {
          let delProofIds = delOps.map(item => item.key)
          IncomingHashes = IncomingHashes.filter(item => !delProofIds.includes(item.proof_id))
        },
        saveProofStatesBatchAsync: async items => {
          ProofStateData = items
        }
      })
      aggregator.setCores({
        submitHashAsync: async () => {
          let hash = crypto.randomBytes(32).toString('hex')
          newProofIdCore1 = generateBlakeEmbeddedUUID(hash)
          newProofIdCore2 = generateBlakeEmbeddedUUID(hash)
          return [
            { ip: ip1, response: { proof_id: newProofIdCore1, hash: hash, processing_hints: 'hints' } },
            { ip: ip2, response: { proof_id: newProofIdCore2, hash: hash, processing_hints: 'hints' } }
          ]
        }
      })
    })
    after(() => {})
    it('should complete successfully', async () => {
      var merkleTools = new MerkleTools()
      expect(IncomingHashes.length).to.equal(hashCount)
      let aggRoot = await aggregator.aggregateSubmitAndPersistAsync()
      //expect(IncomingHashes.length).to.equal(0)
      expect(ProofStateData.length).to.equal(hashCount)
      for (let x = 0; x < hashCount; x++) {
        expect(ProofStateData[x])
          .to.have.property('proofId')
          .and.and.be.a('string')
        expect(ProofStateData[x])
          .to.have.property('hash')
          .and.and.be.a('string')
        expect(ProofStateData[x])
          .to.have.property('proofState')
          .and.and.be.a('array')
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
          .to.have.property('proofId')
          .and.and.be.a('string')
          .and.to.equal(newProofIdCore1)
        expect(ProofStateData[x].submission.cores[1]).to.be.a('object')
        expect(ProofStateData[x].submission.cores[1])
          .to.have.property('ip')
          .and.and.be.a('string')
          .and.to.equal(ip2)
        expect(ProofStateData[x].submission.cores[1])
          .to.have.property('proofId')
          .and.and.be.a('string')
          .and.to.equal(newProofIdCore2)
      }
    })
  })
})

// support functions
function generateIncomingHashData(batchSize) {
  let hashes = []

  for (let x = 0; x < batchSize; x++) {
    let newProofId = uuidv1()
    hashes.push({
      proof_id: newProofId,
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
