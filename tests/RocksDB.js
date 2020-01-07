/* global describe, it, before, after */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const rocksDB = require('../lib/models/RocksDB.js')
const rmrf = require('rimraf')
const uuidv1 = require('uuid/v1')
const crypto = require('crypto')

const TEST_ROCKS_DIR = './test_db'

let insertedProofStateHashIdNodes = null

describe('RocksDB Methods', () => {
  let db = null
  before(async () => {
    db = await rocksDB.openConnectionAsync(TEST_ROCKS_DIR)
    expect(db).to.be.a('object')
  })
  after(() => {
    db.close(() => {
      rmrf.sync(TEST_ROCKS_DIR)
    })
  })

  describe('Proof State Functions', () => {
    it('should return the same data that was inserted', async () => {
      let sampleData = generateSampleProofStateData(100)
      await rocksDB.saveProofStatesBatchAsync(sampleData.state)
      let queriedState = await rocksDB.getProofStatesBatchByProofIdsAsync(sampleData.proofIdNodes)
      insertedProofStateHashIdNodes = sampleData.proofIdNodes
      queriedState = convertStateBackToBinaryForm(queriedState)
      expect(queriedState).to.deep.equal(sampleData.state)
    })
  })

  describe('Incoming Hash Functions', () => {
    let delOps = []
    it('should return the same data that was inserted', async () => {
      let sampleData = generateSampleHashObjects(100)
      await rocksDB.queueIncomingHashObjectsAsync(sampleData)
      let getResults = await rocksDB.getIncomingHashesUpToAsync(Date.now)
      let queriedHashes = getResults[0]
      delOps = getResults[1]
      expect(queriedHashes).to.deep.equal(sampleData)
    })
    after(async () => {
      await db.batch(delOps)
    })
  })

  describe('Generic key/value Functions', () => {
    it('should return the same value that was inserted', async () => {
      let keys = []
      let values = []
      for (let x = 0; x < 100; x++) {
        keys.push(`testKey${x}${crypto.randomBytes(8).toString('hex')}`)
        values.push(crypto.randomBytes(8).toString('hex'))
      }
      for (let x = 0; x < 100; x++) {
        await rocksDB.setAsync(keys[x], values[x])
      }

      let getValues = []
      for (let x = 0; x < 100; x++) {
        getValues.push(await rocksDB.getAsync(keys[x]))
      }
      expect(getValues).to.deep.equal(values)

      let delOps = []
      for (let key of keys) {
        delOps.push({ type: 'del', key: key })
      }
      rocksDB.deleteBatchAsync(delOps).then(async () => {
        let getValues = []
        for (let x = 0; x < 100; x++) {
          getValues.push(await rocksDB.getAsync(keys[x]))
        }
        expect(getValues).to.deep.equal(values)
      })
    })
  })

  describe('Delete/Prune Functions', () => {
    before(() => {
      rocksDB.setENV({
        PROOF_EXPIRE_MINUTES: 0
      })
    })
    it('should batch delete as expected', async () => {
      let keys = []
      let values = []
      for (let x = 0; x < 100; x++) {
        keys.push(`testKey${x}${crypto.randomBytes(8).toString('hex')}`)
        values.push(crypto.randomBytes(8).toString('hex'))
      }
      for (let x = 0; x < 100; x++) {
        await rocksDB.setAsync(keys[x], values[x])
      }
      let getValues = []
      for (let x = 0; x < 100; x++) {
        getValues.push(await rocksDB.getAsync(keys[x]))
      }
      expect(getValues).to.deep.equal(values)

      let delOps = []
      for (let key of keys) {
        delOps.push({ type: 'del', key: `custom_key:${key}` })
      }
      await rocksDB.deleteBatchAsync(delOps)
      getValues = []
      for (let x = 0; x < 100; x++) {
        let getResult = await rocksDB.getAsync(keys[x])
        expect(getResult).to.equal(null)
      }
    })

    it('should initiate prune interval as expected', async () => {
      let interval = rocksDB.startPruningInterval()
      expect(interval).to.be.a('object')
      clearInterval(interval)
    })

    it('should prune proof state data as expected', async () => {
      // retrieve inserted proof state, confirm it still exists
      let queriedState = await rocksDB.getProofStatesBatchByProofIdsAsync(insertedProofStateHashIdNodes)
      expect(queriedState).to.be.a('array')
      expect(queriedState.length).to.be.greaterThan(0)
      for (let x = 0; x < queriedState.length; x++) {
        expect(queriedState[x]).to.have.property('hash')
        expect(queriedState[x].hash).to.be.a('string')
      }

      // prune all proof state data (0 minute expiration)
      await rocksDB.pruneOldProofStateDataAsync()

      // retrieve inserted proof state, confirm it has all beed pruned
      queriedState = await rocksDB.getProofStatesBatchByProofIdsAsync(insertedProofStateHashIdNodes)
      expect(queriedState).to.be.a('array')
      expect(queriedState.length).to.be.greaterThan(0)
      for (let x = 0; x < queriedState.length; x++) {
        expect(queriedState[x]).to.have.property('hash')
        expect(queriedState[x].hash).to.equal(null)
      }
    })
  })

  describe('Other Functions', () => {
    it('hexToUUIDv1 should return null with invalid hex value', done => {
      let result = rocksDB.hexToUUIDv1('deadbeefcafe')
      expect(result).to.equal(null)
      done()
    })
    it('hexToUUIDv1 should return the expected result with proper hex value', done => {
      let result = rocksDB.hexToUUIDv1('ed60c311ede60102689f66a9e98feab6')
      expect(result)
        .to.be.a('string')
        .and.to.equal('ed60c311-ede6-0102-689f-66a9e98feab6')
      done()
    })
  })
})

// support functions

function generateSampleProofStateData(batchSize) {
  let results = {}
  results.state = []
  results.proofIdNodes = []

  for (let x = 0; x < batchSize; x++) {
    let newHashIdNode = uuidv1()
    let submitId = uuidv1()
    results.state.push({
      proofId: newHashIdNode,
      hash: crypto.randomBytes(32).toString('hex'),
      proofState: [Buffer.from(Math.round(Math.random()) ? '00' : '01', 'hex'), crypto.randomBytes(32)],
      submission: {
        submitId: submitId,
        cores: [
          { ip: '65.1.12.122', proofId: uuidv1() },
          { ip: '65.1.12.123', proofId: uuidv1() },
          { ip: '65.1.12.124', proofId: uuidv1() }
        ]
      }
    })
    results.proofIdNodes.push(newHashIdNode)
  }

  return results
}

function convertStateBackToBinaryForm(queriedState) {
  for (let stateItem of queriedState) {
    let binState
    for (let psItem of stateItem.proofState) {
      binState = []
      if (psItem.left) {
        binState.push(Buffer.from('00', 'hex'))
        binState.push(Buffer.from(psItem.left, 'hex'))
      } else {
        binState.push(Buffer.from('01', 'hex'))
        binState.push(Buffer.from(psItem.right, 'hex'))
      }
    }
    stateItem.proofState = binState
  }
  return queriedState
}

function generateSampleHashObjects(batchSize) {
  let results = []

  for (let x = 0; x < batchSize; x++) {
    results.push({
      proof_id: uuidv1(),
      hash: crypto.randomBytes(32).toString('hex')
    })
  }

  return results
}
