/* global describe, it beforeEach, afterEach */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect
const request = require('supertest')

const app = require('../lib/api-server.js')
const reputation = require('../lib/endpoints/reputation.js')

const GET_REPUTATION_MAX = 2
let getRecentIterationCount = 0

describe('Reputation Controller', () => {
  let insecureServer = null
  beforeEach(async () => {
    insecureServer = await app.startInsecureRestifyServerAsync()
    reputation.setRocksDB({
      getReputationItemsRangeByIdsAsync: async (min, max) => {
        if (min == 127 && max == 128) {
          return []
        } else if (min == 128 && max == 129) {
          return [{ id: 128, val: 'a' }, { id: 129, val: 'b' }]
        }
      },
      getReputationItemProofsRangeByRepIdsAsync: async (minId, maxId) => {
        if (minId == 128 && maxId == 129) {
          return [{ id: 128, proof: '{"val":0}' }, { id: 129, proof: '{"val":1}' }]
        }
      },
      getReputationItemByIdAsync: async id => {
        if (id == 127) {
          return null
        } else if (id === 128) {
          return { id: 128, val: 'a' }
        }
      },
      getReputationItemProofByRepIdAsync: async repId => {
        if (repId == 128) {
          return '{"val":0}'
        }
      },
      getReputationItemsBetweenAsync: async () => {
        getRecentIterationCount++
        if (getRecentIterationCount === 1) return []
        return [{ id: 128, val: 'a' }, { id: 129, val: 'b' }]
      }
    })
    reputation.setENV({ GET_REPUTATION_MAX: GET_REPUTATION_MAX })
  })
  afterEach(() => {
    insecureServer.close()
  })

  describe('GET /reputation/min/max', () => {
    it('should return the proper error when min not an integer', done => {
      request(insecureServer)
        .get('/reputation/min/max')
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('invalid request, min id must be a positive integer')
          done()
        })
    })

    it('should return the proper error when max not an integer', done => {
      request(insecureServer)
        .get('/reputation/12/max')
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('invalid request, max id must be a positive integer')
          done()
        })
    })

    it('should return the proper error when max < min', done => {
      request(insecureServer)
        .get('/reputation/12/10')
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('invalid request, max must be greater than or equal to min')
          done()
        })
    })

    it('should return the proper error too many requested', done => {
      request(insecureServer)
        .get('/reputation/12/25')
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal(`invalid request, limit of ${GET_REPUTATION_MAX} per request`)
          done()
        })
    })

    it('should return the proper error empty result set', done => {
      request(insecureServer)
        .get('/reputation/127/128')
        .expect('Content-type', /json/)
        .expect(404)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('NotFound')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('')
          done()
        })
    })

    it('should return the proper results on success', done => {
      request(insecureServer)
        .get('/reputation/128/129')
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body.length).to.equal(2)
          expect(res.body[0]).to.be.a('object')
          expect(res.body[0])
            .to.have.property('id')
            .and.to.equal(128)
          expect(res.body[0])
            .to.have.property('val')
            .and.to.equal('a')
          expect(res.body[0])
            .to.have.property('proof')
            .and.to.deep.equal({ val: 0 })
          expect(res.body[1]).to.be.a('object')
          expect(res.body[1])
            .to.have.property('id')
            .and.to.equal(129)
          expect(res.body[1])
            .to.have.property('val')
            .and.to.equal('b')
          expect(res.body[1])
            .to.have.property('proof')
            .and.to.deep.equal({ val: 1 })
          done()
        })
    })
  })

  describe('GET /reputation/id', () => {
    it('should return the proper error when id not an integer', done => {
      request(insecureServer)
        .get('/reputation/id')
        .expect('Content-type', /json/)
        .expect(409)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('InvalidArgument')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('invalid request, id must be a positive integer')
          done()
        })
    })

    it('should return the proper error not found', done => {
      request(insecureServer)
        .get('/reputation/127')
        .expect('Content-type', /json/)
        .expect(404)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('NotFound')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('')
          done()
        })
    })

    it('should return the proper results on success', done => {
      request(insecureServer)
        .get('/reputation/128')
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('object')
          expect(res.body)
            .to.have.property('id')
            .and.to.equal(128)
          expect(res.body)
            .to.have.property('val')
            .and.to.equal('a')
          expect(res.body)
            .to.have.property('proof')
            .and.to.deep.equal({ val: 0 })
          done()
        })
    })
  })

  describe('GET /reputation/recent', () => {
    it('should return the proper error empty result set', done => {
      request(insecureServer)
        .get('/reputation/recent')
        .expect('Content-type', /json/)
        .expect(404)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('NotFound')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('')
          done()
        })
    })

    it('should return the proper results on success', done => {
      request(insecureServer)
        .get('/reputation/recent')
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body.length).to.equal(2)
          expect(res.body[0]).to.be.a('object')
          expect(res.body[0])
            .to.have.property('id')
            .and.to.equal(128)
          expect(res.body[0])
            .to.have.property('val')
            .and.to.equal('a')
          expect(res.body[0])
            .to.have.property('proof')
            .and.to.deep.equal({ val: 0 })
          expect(res.body[1]).to.be.a('object')
          expect(res.body[1])
            .to.have.property('id')
            .and.to.equal(129)
          expect(res.body[1])
            .to.have.property('val')
            .and.to.equal('b')
          expect(res.body[1])
            .to.have.property('proof')
            .and.to.deep.equal({ val: 1 })
          done()
        })
    })
  })
})
