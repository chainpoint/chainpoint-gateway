/* global describe, it, beforeEach, before */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const eventMetrics = require('../lib/event-metrics.js')

describe('Event Metrics Methods', () => {
  beforeEach(() => {
    eventMetrics.resetCountMetrics()
    eventMetrics.resetRecentHashData()
  })
  describe('captureEvent', () => {
    it('should create and increment keys as expected', done => {
      let timestamp1 = 1550160008000 // Thursday, February 14, 2019 4:00:08 PM GMT
      let timestamp2 = 1550163608000 // Thursday, February 14, 2019 5:00:08 PM GMT
      eventMetrics.captureEvent('testevent1', 5, timestamp1)
      eventMetrics.captureEvent('testevent1', 2, timestamp1)
      eventMetrics.captureEvent('testevent1', 3, timestamp2)
      eventMetrics.captureEvent('testevent2', 1, timestamp2)
      let metrics = eventMetrics.getCountMetrics()
      expect(metrics).to.be.a('object')
      expect(metrics).to.have.property('nodestats:counter:2019:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2019:02:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2019:02:14:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2019:02:14:16:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2019:02:14:17:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2019:testevent2')
      expect(metrics).to.have.property('nodestats:counter:2019:02:testevent2')
      expect(metrics).to.have.property('nodestats:counter:2019:02:14:testevent2')
      expect(metrics).to.have.property('nodestats:counter:2019:02:14:17:testevent2')
      expect(metrics['nodestats:counter:2019:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2019:02:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2019:02:14:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2019:02:14:16:testevent1']).to.equal(7)
      expect(metrics['nodestats:counter:2019:02:14:17:testevent1']).to.equal(3)
      expect(metrics['nodestats:counter:2019:testevent2']).to.equal(1)
      expect(metrics['nodestats:counter:2019:02:testevent2']).to.equal(1)
      expect(metrics['nodestats:counter:2019:02:14:testevent2']).to.equal(1)
      expect(metrics['nodestats:counter:2019:02:14:17:testevent2']).to.equal(1)
      done()
    })
  })

  describe('logRecentHash', () => {
    it('should update recent hash data as expected', done => {
      let hashCount = 25
      for (let x = 1; x <= hashCount + 5; x++) {
        eventMetrics.logRecentHash(x.toString(), x.toString(), x.toString())
      }
      let recentHashes = eventMetrics.getRecentHashData()
      // this should only contain the last 'hashCount' items logged
      expect(recentHashes).to.be.a('array')
      expect(recentHashes.length).to.equal(hashCount)
      expect(recentHashes[0])
        .to.have.property('hashIdNode')
        .and.to.be.a('string')
        .and.to.equal('30')
      expect(recentHashes[0])
        .to.have.property('hash')
        .and.to.be.a('string')
        .and.to.equal('30')
      expect(recentHashes[0])
        .to.have.property('submittedAt')
        .and.to.be.a('string')
        .and.to.equal('30')
      expect(recentHashes[24])
        .to.have.property('hashIdNode')
        .and.to.be.a('string')
        .and.to.equal('6')
      expect(recentHashes[24])
        .to.have.property('hash')
        .and.to.be.a('string')
        .and.to.equal('6')
      expect(recentHashes[24])
        .to.have.property('submittedAt')
        .and.to.be.a('string')
        .and.to.equal('6')
      done()
    })
  })

  describe('getMetricsByTypeAndTimestamp', () => {
    it('should return expected results', done => {
      let timestamp1 = 1550160008000 // Thursday, February 14, 2019 4:00:08 PM GMT
      let twoHoursAgo = timestamp1 - 7200000
      eventMetrics.captureEvent('testevent1', 5, timestamp1)
      eventMetrics.captureEvent('testevent1', 5, twoHoursAgo)
      let counts = eventMetrics.getMetricsByTypeAndTimestamp('testevent1', timestamp1)
      expect(counts).to.be.a('object')
      expect(counts)
        .to.have.property('year')
        .and.to.be.a('number')
        .and.to.equal(10)
      expect(counts)
        .to.have.property('month')
        .and.to.be.a('number')
        .and.to.equal(10)
      expect(counts)
        .to.have.property('day')
        .and.to.be.a('number')
        .and.to.equal(10)
      expect(counts)
        .to.have.property('last24Hrs')
        .and.to.be.a('number')
        .and.to.equal(10)
      expect(counts)
        .to.have.property('hour')
        .and.to.be.a('number')
        .and.to.equal(5)
      done()
    })
  })

  describe('getRecentHashDataFlattenedArray', () => {
    it('should return expected results', done => {
      let hashCount = 25
      for (let x = 1; x <= hashCount + 5; x++) {
        eventMetrics.logRecentHash(x.toString(), x.toString(), x.toString())
      }
      let results = eventMetrics.getRecentHashDataFlattenedArray()
      let id = 30
      for (let x = 0; x < hashCount; x++) {
        expect(results[x])
          .to.be.a('string')
          .and.to.equal(`${id}|${id}|${id}`)
        id--
      }
      done()
    })
  })

  describe('loadMetricsAsync', () => {
    before(() => {
      eventMetrics.setRocksDB({
        getCountMetricsAsync: async () => {
          return [
            { key: 'nodestats:counter:2019:testevent1', value: 10 },
            { key: 'nodestats:counter:2019:02:testevent1', value: 10 },
            { key: 'nodestats:counter:2019:02:14:testevent1', value: 10 },
            { key: 'nodestats:counter:2019:02:14:16:testevent1', value: 7 },
            { key: 'nodestats:counter:2019:02:14:17:testevent1', value: 3 },
            { key: 'nodestats:counter:2019:testevent2', value: 1 },
            { key: 'nodestats:counter:2019:02:testevent2', value: 1 },
            { key: 'nodestats:counter:2019:02:14:testevent2', value: 1 },
            { key: 'nodestats:counter:2019:02:14:17:testevent2', value: 1 }
          ]
        },
        getRecentHashDataAsync: async () => {
          return [
            { hashIdNode: '1', hash: '1', submittedAt: '1' },
            { hashIdNode: '2', hash: '2', submittedAt: '2' },
            { hashIdNode: '3', hash: '3', submittedAt: '3' }
          ]
        }
      })
    })
    it('should perform as expected', async () => {
      await eventMetrics.loadMetricsAsync()
      let metrics = eventMetrics.getCountMetrics()
      expect(metrics['nodestats:counter:2019:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2019:02:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2019:02:14:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2019:02:14:16:testevent1']).to.equal(7)
      expect(metrics['nodestats:counter:2019:02:14:17:testevent1']).to.equal(3)
      expect(metrics['nodestats:counter:2019:testevent2']).to.equal(1)
      expect(metrics['nodestats:counter:2019:02:testevent2']).to.equal(1)
      expect(metrics['nodestats:counter:2019:02:14:testevent2']).to.equal(1)
      expect(metrics['nodestats:counter:2019:02:14:17:testevent2']).to.equal(1)
      let recentHashes = eventMetrics.getRecentHashData()
      expect(recentHashes).to.be.a('array')
      expect(recentHashes.length).to.equal(3)
      expect(recentHashes[0])
        .to.have.property('hashIdNode')
        .and.to.be.a('string')
        .and.to.equal('1')
      expect(recentHashes[0])
        .to.have.property('hash')
        .and.to.be.a('string')
        .and.to.equal('1')
      expect(recentHashes[0])
        .to.have.property('submittedAt')
        .and.to.be.a('string')
        .and.to.equal('1')
      expect(recentHashes[2])
        .to.have.property('hashIdNode')
        .and.to.be.a('string')
        .and.to.equal('3')
      expect(recentHashes[2])
        .to.have.property('hash')
        .and.to.be.a('string')
        .and.to.equal('3')
      expect(recentHashes[2])
        .to.have.property('submittedAt')
        .and.to.be.a('string')
        .and.to.equal('3')
    })
  })

  describe('startPersistDataInterval', () => {
    it('should initiate interval as expected', async () => {
      let interval = eventMetrics.startPersistDataInterval()
      expect(interval).to.be.a('object')
      clearInterval(interval)
    })
  })

  describe('persistDataAsync', () => {
    let metricObjects = null
    let prunedKeys = null
    let hashObjects = null
    before(() => {
      metricObjects = []
      prunedKeys = []
      hashObjects = []
      eventMetrics.setRocksDB({
        saveCountMetricsAsync: (mObj, pKeys) => {
          metricObjects = mObj
          prunedKeys = pKeys
        },
        saveRecentHashDataAsync: hObj => {
          hashObjects = hObj
        }
      })
    })
    it('should do nothing when INITIALIZED === false', async () => {
      let timestamp1 = 1540501200000 // Thursday, October 25, 2018 9:00:00 PM GMT
      let timestamp2 = Date.now()
      eventMetrics.captureEvent('testevent1', 10, timestamp1)
      eventMetrics.captureEvent('testevent2', 15, timestamp2)
      let metrics = eventMetrics.getCountMetrics()
      expect(metrics).to.be.a('object')
      expect(Object.keys(metrics).length).to.equal(8)
      expect(metrics).to.have.property('nodestats:counter:2018:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:25:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:25:21:testevent1')
      expect(metrics['nodestats:counter:2018:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2018:10:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2018:10:25:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2018:10:25:21:testevent1']).to.equal(10)
      eventMetrics.setInitialized(false)
      await eventMetrics.persistDataAsync()
      metrics = eventMetrics.getCountMetrics()
      expect(metrics).to.be.a('object')
      expect(Object.keys(metrics).length).to.equal(8)
      expect(metrics).to.have.property('nodestats:counter:2018:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:25:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:25:21:testevent1')
      expect(metrics['nodestats:counter:2018:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2018:10:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2018:10:25:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2018:10:25:21:testevent1']).to.equal(10)
      expect(metricObjects).to.be.a('array')
      expect(metricObjects.length).to.equal(0)
      expect(prunedKeys).to.be.a('array')
      expect(prunedKeys.length).to.equal(0)
      expect(hashObjects).to.be.a('array')
      expect(hashObjects.length).to.equal(0)
    })
    it('should complete successfully when INITIALIZED === true', async () => {
      let timestamp1 = 1540501200000 // Thursday, October 25, 2018 9:00:00 PM GMT
      let timestamp2 = Date.now()
      eventMetrics.captureEvent('testevent1', 10, timestamp1)
      eventMetrics.captureEvent('testevent2', 15, timestamp2)
      let hashCount = 25
      for (let x = 1; x <= hashCount + 5; x++) {
        eventMetrics.logRecentHash(x.toString(), x.toString(), x.toString())
      }
      let metrics = eventMetrics.getCountMetrics()
      expect(metrics).to.be.a('object')
      expect(Object.keys(metrics).length).to.equal(8)
      expect(metrics).to.have.property('nodestats:counter:2018:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:25:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:25:21:testevent1')
      expect(metrics['nodestats:counter:2018:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2018:10:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2018:10:25:testevent1']).to.equal(10)
      expect(metrics['nodestats:counter:2018:10:25:21:testevent1']).to.equal(10)
      eventMetrics.setInitialized(true)
      await eventMetrics.persistDataAsync()
      metrics = eventMetrics.getCountMetrics()
      expect(metrics).to.be.a('object')
      expect(Object.keys(metrics).length).to.equal(7)
      expect(metrics).to.have.property('nodestats:counter:2018:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:testevent1')
      expect(metrics).to.have.property('nodestats:counter:2018:10:25:testevent1')
      expect(metrics).to.not.have.property('nodestats:counter:2018:10:25:21:testevent1')
      expect(metricObjects).to.be.a('array')
      expect(metricObjects.length).to.equal(7)
      expect(metricObjects[0]).to.be.a('object')
      expect(metricObjects[0])
        .to.have.property('key')
        .and.to.be.a('string')
        .and.to.equal('nodestats:counter:2018:testevent1')
      expect(metricObjects[0])
        .to.have.property('value')
        .and.to.be.a('number')
        .and.to.equal(10)
      expect(prunedKeys).to.be.a('array')
      expect(prunedKeys.length).to.equal(1)
      expect(prunedKeys[0])
        .to.be.a('string')
        .and.to.equal('nodestats:counter:2018:10:25:21:testevent1')
      expect(hashObjects).to.be.a('array')
      expect(hashObjects.length).to.equal(hashCount)
    })
  })
})
