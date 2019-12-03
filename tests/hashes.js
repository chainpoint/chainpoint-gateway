/* global describe, it beforeEach, afterEach, before, after */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect
const request = require('supertest')

const app = require('../lib/api-server.js')
const hashes = require('../lib/endpoints/hashes.js')

describe('Hashes Controller', () => {
  let insecureServer = null
  beforeEach(async () => {
    insecureServer = await app.startInsecureRestifyServerAsync()
    hashes.setRocksDB({
      queueIncomingHashObjectsAsync: async () => {}
    })
    hashes.setENV({ POST_HASHES_MAX: 1, AGGREGATION_INTERVAL_SECONDS: 60 })
  })
  afterEach(() => {
    insecureServer.close()
  })

  describe('POST /hashes', () => {
    before(() => {
      app.setAcceptingHashes(false)
    })
    after(() => {
      app.setAcceptingHashes(true)
    })
    it('should return the proper error when not accepting hashes', done => {
      request(insecureServer)
        .post('/hashes')
        .set('Content-type', 'text/plain')
        .expect('Content-type', /json/)
        .expect(503)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body)
            .to.have.property('code')
            .and.to.be.a('string')
            .and.to.equal('ServiceUnavailable')
          expect(res.body)
            .to.have.property('message')
            .and.to.be.a('string')
            .and.to.equal('Service is not currently accepting hashes')
          done()
        })
    })
  })

  describe('POST /hashes', () => {
    it('should return the proper error with bad content type', done => {
      request(insecureServer)
        .post('/hashes')
        .set('Content-type', 'text/plain')
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
            .and.to.equal('invalid content type')
          done()
        })
    })

    it('should return the proper error with missing hashes property', done => {
      request(insecureServer)
        .post('/hashes')
        .set('Content-type', 'application/json')
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
            .and.to.equal('invalid JSON body, missing hashes')
          done()
        })
    })

    it('should return the proper error with hashes not an array', done => {
      request(insecureServer)
        .post('/hashes')
        .set('Content-type', 'application/json')
        .send({ hashes: 'notarray' })
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
            .and.to.equal('invalid JSON body, hashes is not an Array')
          done()
        })
    })

    it('should return the proper error with empty hashes array', done => {
      request(insecureServer)
        .post('/hashes')
        .set('Content-type', 'application/json')
        .send({ hashes: [] })
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
            .and.to.equal('invalid JSON body, hashes Array is empty')
          done()
        })
    })

    it('should return the proper error with max hashes exceeded', done => {
      request(insecureServer)
        .post('/hashes')
        .set('Content-type', 'application/json')
        .send({ hashes: ['a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', 'b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1'] })
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
            .and.to.equal(`invalid JSON body, hashes Array max size of 1 exceeded`)
          done()
        })
    })

    it('should return the proper error with invalid hashes', done => {
      request(insecureServer)
        .post('/hashes')
        .set('Content-type', 'application/json')
        .send({ hashes: ['invalid'] })
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
            .and.to.equal(`invalid JSON body, invalid hashes present`)
          done()
        })
    })

    it('should return the proper result on success', done => {
      let hash = 'a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1'
      request(insecureServer)
        .post('/hashes')
        .set('Content-type', 'application/json')
        .send({ hashes: [hash] })
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.have.property('meta')
          expect(res.body.meta)
            .to.have.property('submitted_at')
            .and.to.be.a('string')
          expect(res.body.meta).to.have.property('processing_hints')
          expect(res.body.meta.processing_hints)
            .to.have.property('cal')
            .and.to.be.a('string')
          expect(res.body.meta.processing_hints)
            .to.have.property('btc')
            .and.to.be.a('string')
          expect(res.body)
            .to.have.property('hashes')
            .and.to.be.a('array')
          expect(res.body.hashes).to.have.length(1)
          expect(Object.keys(res.body.hashes[0]).length).to.equal(2)
          expect(res.body.hashes[0])
            .to.have.property('proof_id')
            .and.to.be.a('string')
          expect(res.body.hashes[0])
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal(hash)
          done()
        })
    })
  })
})
