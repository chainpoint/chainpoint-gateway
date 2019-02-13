/* global describe, it beforeEach, afterEach, before */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect
const request = require('supertest')

const app = require('../lib/api-server.js')
const stats = require('../lib/endpoints/stats.js')

describe('Stats Controller', () => {
  let insecureServer = null
  beforeEach(async () => {
    insecureServer = await app.startInsecureRestifyServerAsync()
    stats.setEventMetrics({
      getRecentHashDataFlattenedArray: () => {
        return [
          '720b5100-2eea-11e9-9c57-0158de81ab91|CF1A7520099830C5D6A348F96B318D8FBFECB977E06B0D3BB677AAAE55FD4548|2019-02-12T17:20:08Z',
          'bf4182b0-2ee9-11e9-9c57-01d04b41773f|37FF03523518C137D3B8F86F173BB8E80B4BA9DEB23E6381C8FF9664F1050240|2019-02-12T17:15:08Z'
        ]
      },
      getMetricsByTypeAndTimestamp: () => {
        return {
          year: 10000,
          month: 1300,
          day: 25,
          last24Hrs: 32,
          hour: 2
        }
      }
    })
    stats.setRocksDB({
      getAsync: async key => {
        switch (key) {
          case 'dataFromCore':
            return { coreKey1: 'coreValue1' }
          case 'dataFromCoreLastReceived':
            return '2019-02-12T17:40:08Z'
        }
      }
    })
  })
  afterEach(() => {
    insecureServer.close()
  })

  describe('GET /stats', () => {
    describe('with CHAINPOINT_NODE_UI_PASSWORD setting made', () => {
      before(() => {
        stats.setENV({
          CHAINPOINT_NODE_UI_PASSWORD: 'password'
        })
      })
      it('should return the proper error with no auth header', done => {
        request(insecureServer)
          .get('/stats')
          .expect('Content-type', /json/)
          .expect(401)
          .end((err, res) => {
            expect(err).to.equal(null)
            expect(res.body)
              .and.to.be.a('string')
              .and.to.equal('Unauthorized: Node is not Public. Please provide a valid authentication header value.')
            done()
          })
      })
      it('should return the proper error with empty auth header', done => {
        request(insecureServer)
          .get('/stats')
          .set('auth', '')
          .expect('Content-type', /json/)
          .expect(401)
          .end((err, res) => {
            expect(err).to.equal(null)
            expect(res.body)
              .and.to.be.a('string')
              .and.to.equal('Unauthorized: Node is not Public. Please provide a valid authentication header value.')
            done()
          })
      })
      it('should return the proper error with incorrect auth header', done => {
        request(insecureServer)
          .get('/stats')
          .set('auth', 'notpassword')
          .expect('Content-type', /json/)
          .expect(401)
          .end((err, res) => {
            expect(err).to.equal(null)
            expect(res.body)
              .and.to.be.a('string')
              .and.to.equal('Unauthorized: Please provide a valid authentication header value.')
            done()
          })
      })
    })
    describe('with no CHAINPOINT_NODE_UI_PASSWORD setting made', () => {
      before(() => {
        stats.setENV({
          NODE_TNT_ADDRESS: '0xca56356cD2a2bf3202F771F50D3D14A367b48070'
        })
      })
      it('should return the proper error with incorrect auth header', done => {
        request(insecureServer)
          .get('/stats')
          .set('auth', 'notpassword')
          .expect('Content-type', /json/)
          .expect(401)
          .end((err, res) => {
            expect(err).to.equal(null)
            expect(res.body)
              .and.to.be.a('string')
              .and.to.equal('Unauthorized: Please provide a valid authentication header value.')
            done()
          })
      })
      it('should receive successful response with no filter setting', done => {
        request(insecureServer)
          .get('/stats')
          .set('auth', '0xca56356cD2a2bf3202F771F50D3D14A367b48070')
          .expect('Content-type', /json/)
          .expect(200)
          .end((err, res) => {
            expect(err).to.equal(null)
            expect(res.body)
              .to.have.property('last_1_days')
              .and.to.be.a('object')
            expect(res.body.last_1_days)
              .to.have.property('year')
              .and.to.be.a('number')
              .and.to.equal(10000)
            expect(res.body.last_1_days)
              .to.have.property('month')
              .and.to.be.a('number')
              .and.to.equal(1300)
            expect(res.body.last_1_days)
              .to.have.property('day')
              .and.to.be.a('number')
              .and.to.equal(25)
            expect(res.body.last_1_days)
              .to.have.property('last24Hrs')
              .and.to.be.a('number')
              .and.to.equal(32)
            expect(res.body.last_1_days)
              .to.have.property('hashesReceivedToday')
              .and.to.be.a('array')
            expect(res.body.last_1_days.hashesReceivedToday).to.have.length(2)
            expect(res.body.last_1_days.hashesReceivedToday[0]).to.equal(
              '720b5100-2eea-11e9-9c57-0158de81ab91|CF1A7520099830C5D6A348F96B318D8FBFECB977E06B0D3BB677AAAE55FD4548|2019-02-12T17:20:08Z'
            )
            expect(res.body.last_1_days.hashesReceivedToday[1]).to.equal(
              'bf4182b0-2ee9-11e9-9c57-01d04b41773f|37FF03523518C137D3B8F86F173BB8E80B4BA9DEB23E6381C8FF9664F1050240|2019-02-12T17:15:08Z'
            )
            expect(res.body)
              .to.have.property('nodeData')
              .and.to.be.a('object')
            expect(res.body.nodeData)
              .to.have.property('coreKey1')
              .and.to.be.a('string')
              .and.to.equal('coreValue1')
            expect(res.body.nodeData)
              .to.have.property('node_registered')
              .and.to.be.a('boolean')
              .and.to.equal(false)
            expect(res.body.nodeData)
              .to.have.property('node_tnt_addr')
              .and.to.be.a('string')
              .and.to.equal('0xca56356cD2a2bf3202F771F50D3D14A367b48070')
            expect(res.body.nodeData)
              .to.have.property('dataFromCoreLastReceived')
              .and.to.be.a('string')
              .and.to.equal('2019-02-12T17:40:08Z')
            done()
          })
      })
      it('should receive successful response with filter setting last_1_days', done => {
        request(insecureServer)
          .get('/stats?filter=last_1_days')
          .set('auth', '0xca56356cD2a2bf3202F771F50D3D14A367b48070')
          .expect('Content-type', /json/)
          .expect(200)
          .end((err, res) => {
            expect(err).to.equal(null)
            expect(res.body)
              .to.have.property('last_1_days')
              .and.to.be.a('object')
            expect(res.body.last_1_days)
              .to.have.property('year')
              .and.to.be.a('number')
              .and.to.equal(10000)
            expect(res.body.last_1_days)
              .to.have.property('month')
              .and.to.be.a('number')
              .and.to.equal(1300)
            expect(res.body.last_1_days)
              .to.have.property('day')
              .and.to.be.a('number')
              .and.to.equal(25)
            expect(res.body.last_1_days)
              .to.have.property('last24Hrs')
              .and.to.be.a('number')
              .and.to.equal(32)
            expect(res.body.last_1_days)
              .to.have.property('hashesReceivedToday')
              .and.to.be.a('array')
            expect(res.body.last_1_days.hashesReceivedToday).to.have.length(2)
            expect(res.body.last_1_days.hashesReceivedToday[0]).to.equal(
              '720b5100-2eea-11e9-9c57-0158de81ab91|CF1A7520099830C5D6A348F96B318D8FBFECB977E06B0D3BB677AAAE55FD4548|2019-02-12T17:20:08Z'
            )
            expect(res.body.last_1_days.hashesReceivedToday[1]).to.equal(
              'bf4182b0-2ee9-11e9-9c57-01d04b41773f|37FF03523518C137D3B8F86F173BB8E80B4BA9DEB23E6381C8FF9664F1050240|2019-02-12T17:15:08Z'
            )
            expect(res.body)
              .to.have.property('nodeData')
              .and.to.be.a('object')
            expect(res.body.nodeData)
              .to.have.property('coreKey1')
              .and.to.be.a('string')
              .and.to.equal('coreValue1')
            expect(res.body.nodeData)
              .to.have.property('node_registered')
              .and.to.be.a('boolean')
              .and.to.equal(false)
            expect(res.body.nodeData)
              .to.have.property('node_tnt_addr')
              .and.to.be.a('string')
              .and.to.equal('0xca56356cD2a2bf3202F771F50D3D14A367b48070')
            expect(res.body.nodeData)
              .to.have.property('dataFromCoreLastReceived')
              .and.to.be.a('string')
              .and.to.equal('2019-02-12T17:40:08Z')
            done()
          })
      })
      it('should receive successful response with filter setting unknown', done => {
        request(insecureServer)
          .get('/stats?filter=unknown')
          .set('auth', '0xca56356cD2a2bf3202F771F50D3D14A367b48070')
          .expect('Content-type', /json/)
          .expect(200)
          .end((err, res) => {
            expect(err).to.equal(null)
            expect(res.body)
              .to.have.property('nodeData')
              .and.to.be.a('object')
            expect(res.body.nodeData)
              .to.have.property('coreKey1')
              .and.to.be.a('string')
              .and.to.equal('coreValue1')
            expect(res.body.nodeData)
              .to.have.property('node_registered')
              .and.to.be.a('boolean')
              .and.to.equal(false)
            expect(res.body.nodeData)
              .to.have.property('node_tnt_addr')
              .and.to.be.a('string')
              .and.to.equal('0xca56356cD2a2bf3202F771F50D3D14A367b48070')
            expect(res.body.nodeData)
              .to.have.property('dataFromCoreLastReceived')
              .and.to.be.a('string')
              .and.to.equal('2019-02-12T17:40:08Z')
            done()
          })
      })
    })
  })
})
