/* global describe, it, before, after */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const rocksDB = require('../lib/models/RocksDB.js')
const rmrf = require('rimraf')
const uuidv1 = require('uuid/v1')
const crypto = require('crypto')
const utils = require('../lib/utils.js')

const TEST_ROCKS_DIR = './.data/test_db'

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
      let queriedState = await rocksDB.getProofStatesBatchByHashIdNodesAsync(sampleData.hashIdNodes)
      insertedProofStateHashIdNodes = sampleData.hashIdNodes
      queriedState = convertStateBackToBinaryForm(queriedState)
      expect(queriedState).to.deep.equal(sampleData.state)
    })
  })

  describe('Reputation Functions', () => {
    let sampleData = generateSampleReputationItemsData(10)

    it('should return the same data that was inserted and the correct items at specified ids', async () => {
      for (let x = 0; x < 5; x++) {
        await rocksDB.saveReputationItemAsync(sampleData[x])
      }
      await utils.sleepAsync(1000)
      for (let x = 5; x < 10; x++) {
        await rocksDB.saveReputationItemAsync(sampleData[x])
      }
      let queriedItems = await rocksDB.getReputationItemsBetweenAsync(Date.now() - 2000, Date.now())
      let mostRecentItem = await rocksDB.getMostRecentReputationItemAsync()
      expect(queriedItems).to.deep.equal(sampleData)
      expect(mostRecentItem).to.deep.equal(sampleData[sampleData.length - 1])

      let item0 = await rocksDB.getReputationItemByIdAsync(0)
      let items3to7 = await rocksDB.getReputationItemsRangeByIdsAsync(3, 7)
      let item9 = await rocksDB.getReputationItemByIdAsync(9)
      expect(item0).to.deep.equal(sampleData[0])
      expect(items3to7).to.deep.equal(sampleData.slice(3, 8))
      expect(item9).to.deep.equal(sampleData[9])
    })

    it('should return not found with unknown id', async () => {
      let item = await rocksDB.getReputationItemByIdAsync(12000)
      expect(item).to.equal(null)
    })

    it('should return the subset of data that was inserted', async () => {
      let sampleData = generateSampleReputationItemsData(10)
      for (let x = 0; x < 5; x++) {
        await rocksDB.saveReputationItemAsync(sampleData[x])
      }
      await utils.sleepAsync(1000)
      for (let x = 5; x < 10; x++) {
        await rocksDB.saveReputationItemAsync(sampleData[x])
      }
      let queriedItems = await rocksDB.getReputationItemsBetweenAsync(Date.now() - 1000, Date.now() + 10000)
      let mostRecentItem = await rocksDB.getMostRecentReputationItemAsync()
      expect(queriedItems).to.deep.equal(sampleData.slice(5))
      expect(mostRecentItem).to.deep.equal(sampleData[sampleData.length - 1])
    })

    it('should return the subset of data that was inserted', async () => {
      let sampleData = generateSampleReputationItemsData(10)
      for (let x = 0; x < 4; x++) {
        await rocksDB.saveReputationItemAsync(sampleData[x])
      }
      await utils.sleepAsync(500)
      for (let x = 4; x < 6; x++) {
        await rocksDB.saveReputationItemAsync(sampleData[x])
      }
      await utils.sleepAsync(500)
      for (let x = 6; x < 10; x++) {
        await rocksDB.saveReputationItemAsync(sampleData[x])
      }
      let queriedItems = await rocksDB.getReputationItemsBetweenAsync(Date.now() - 600, Date.now() - 400)
      let mostRecentItem = await rocksDB.getMostRecentReputationItemAsync()
      expect(queriedItems).to.deep.equal(sampleData.slice(4, 6))
      expect(mostRecentItem).to.deep.equal(sampleData[sampleData.length - 1])
    })

    it('should update and return the correct recent item', async () => {
      let sampleData = generateSampleReputationItemsData(10)
      for (let x = 0; x < 10; x++) {
        await rocksDB.saveReputationItemAsync(sampleData[x])
        let mostRecentItem = await rocksDB.getMostRecentReputationItemAsync()
        expect(mostRecentItem).to.deep.equal(sampleData[x])
      }
    })

    it('should return null proof with unknown Id', async () => {
      let proof = await rocksDB.getReputationItemProofByRepIdAsync(234)
      expect(proof).to.equal(null)
    })

    it('should return proof with known id', async () => {
      let data = '{ data: 0 }'
      let id = 234
      await rocksDB.saveReputationItemProofAsync(id, data)
      let proof = await rocksDB.getReputationItemProofByRepIdAsync(id)
      expect(proof).to.equal(data)
    })

    it('should throw error with invalid range', async () => {
      let results = await rocksDB.getReputationItemProofsRangeByRepIdsAsync('invalid', 123)
      expect(results)
        .to.be.a('array')
        .and.to.have.length(0)
    })

    it('should return valid partial range with offset', async () => {
      let min = 666
      let max = 777
      for (let x = min; x <= max; x++) {
        let data = `{ data: ${x} }`
        let id = x
        await rocksDB.saveReputationItemProofAsync(id, data)
      }
      let results = await rocksDB.getReputationItemProofsRangeByRepIdsAsync(min - 50, max - 50)
      expect(results)
        .to.be.a('array')
        .and.to.have.length(max - min + 1 - 50)
      for (let x = 0; x <= max - min - 50; x++) {
        expect(results[x]).to.have.property('id')
        expect(results[x]).to.have.property('proof')
        expect(results[x].id)
          .to.be.a('number')
          .and.to.equal(x + min)
        expect(results[x].proof)
          .to.be.a('string')
          .and.to.equal(`{ data: ${x + min} }`)
      }
    })

    it('should return valid full range', async () => {
      let min = 888
      let max = 999
      for (let x = min; x <= max; x++) {
        let data = `{ data: ${x} }`
        let id = x
        await rocksDB.saveReputationItemProofAsync(id, data)
      }
      let results = await rocksDB.getReputationItemProofsRangeByRepIdsAsync(min, max)
      expect(results)
        .to.be.a('array')
        .and.to.have.length(max - min + 1)
      for (let x = 0; x <= max - min; x++) {
        expect(results[x]).to.have.property('id')
        expect(results[x]).to.have.property('proof')
        expect(results[x].id)
          .to.be.a('number')
          .and.to.equal(x + min)
        expect(results[x].proof)
          .to.be.a('string')
          .and.to.equal(`{ data: ${x + min} }`)
      }
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

  describe('Event Metrics Functions', () => {
    it('should return the same count metrics that were inserted', async () => {
      let sampleData = generateCountMetrics(100)
      await rocksDB.saveCountMetricsAsync(sampleData.objects, [])
      // retrieve what has just been written, confirm
      let getResults = await rocksDB.getCountMetricsAsync()
      expect(getResults).to.have.deep.members(sampleData.objects)
      // delete what has just been written, confirm
      await rocksDB.saveCountMetricsAsync([], sampleData.keys)
      getResults = await rocksDB.getCountMetricsAsync()
      expect(getResults).to.deep.equal([])
    })

    it('should return the same recent hashes that were inserted', async () => {
      let sampleData = generateRecentHashes(100)
      await rocksDB.saveRecentHashDataAsync(sampleData)
      let getResults = await rocksDB.getRecentHashDataAsync()
      expect(getResults).to.deep.equal(sampleData)
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
      let queriedState = await rocksDB.getProofStatesBatchByHashIdNodesAsync(insertedProofStateHashIdNodes)
      expect(queriedState).to.be.a('array')
      expect(queriedState.length).to.be.greaterThan(0)
      for (let x = 0; x < queriedState.length; x++) {
        expect(queriedState[x]).to.have.property('hash')
        expect(queriedState[x].hash).to.be.a('string')
      }

      // prune all proof state data (0 minute expiration)
      await rocksDB.pruneOldProofStateDataAsync()

      // retrieve inserted proof state, confirm it has all beed pruned
      queriedState = await rocksDB.getProofStatesBatchByHashIdNodesAsync(insertedProofStateHashIdNodes)
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
function generateSampleReputationItemsData(count) {
  let results = []

  for (let x = 0; x < count; x++) {
    results.push({
      id: x,
      calBlockHeight: 100000 + x,
      calBlockHash: crypto.randomBytes(32).toString('hex'),
      prevRepItemHash: crypto.randomBytes(32).toString('hex'),
      hashIdNode: uuidv1(),
      repItemHash: crypto.randomBytes(32).toString('hex'),
      signature: crypto.randomBytes(64).toString('hex')
    })
  }

  return results
}

function generateSampleProofStateData(batchSize) {
  let results = {}
  results.state = []
  results.hashIdNodes = []

  for (let x = 0; x < batchSize; x++) {
    let newHashIdNode = uuidv1()
    let submitId = uuidv1()
    results.state.push({
      hashIdNode: newHashIdNode,
      hash: crypto.randomBytes(32).toString('hex'),
      proofState: [Buffer.from(Math.round(Math.random()) ? '00' : '01', 'hex'), crypto.randomBytes(32)],
      submission: {
        submitId: submitId,
        cores: [
          { ip: '65.1.12.122', hashIdCore: uuidv1() },
          { ip: '65.1.12.123', hashIdCore: uuidv1() },
          { ip: '65.1.12.124', hashIdCore: uuidv1() }
        ]
      }
    })
    results.hashIdNodes.push(newHashIdNode)
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
      hash_id_node: uuidv1(),
      hash: crypto.randomBytes(32).toString('hex')
    })
  }

  return results
}

function generateCountMetrics(batchSize) {
  let results = {}
  results.objects = []
  results.keys = []

  for (let x = 0; x < batchSize; x++) {
    let newKey = `nodestats:counter:${crypto.randomBytes(32).toString('hex')}`
    results.objects.push({
      key: newKey,
      value: Math.ceil(Math.random() * 1000)
    })
    results.keys.push(newKey)
  }

  return results
}

function generateRecentHashes(batchSize) {
  let results = []
  for (let x = 0; x < batchSize; x++) {
    results.push({
      hashIdNode: uuidv1(),
      hash: crypto.randomBytes(32).toString('hex'),
      submittedAt: utils.formatDateISO8601NoMs(new Date())
    })
  }

  return results
}
