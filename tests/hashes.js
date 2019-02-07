/* global describe, it beforeEach, afterEach */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect
const request = require('supertest')

const app = require('../lib/api-server.js')

describe('Hashes Controller', () => {
  let insecureServer = null
  beforeEach(async () => {
    insecureServer = await app.startInsecureRestifyServerAsync()
  })
  afterEach(() => {
    insecureServer.close()
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

    /*
      it('should return the proper error with bad content type', done => {
        request(insecureServer)
          .get('/config')
          .expect('Content-type', /json/)
          .expect(200)
          .end((err, res) => {
            expect(err).to.equal(null)
            expect(Object.keys(res.body).length).to.equal(6)
            expect(res.body)
              .to.have.property('version')
              .and.to.be.a('string')
              .and.to.equal(version)
            expect(res.body)
              .to.have.property('proof_expire_minutes')
              .and.to.be.a('number')
            expect(res.body)
              .to.have.property('get_proofs_max_rest')
              .and.to.be.a('number')
            expect(res.body)
              .to.have.property('post_hashes_max')
              .and.to.be.a('number')
            expect(res.body)
              .to.have.property('post_verify_proofs_max')
              .and.to.be.a('number')
            expect(res.body)
              .to.have.property('time')
              .and.to.be.a('string')
            done()
          })
      })
    })
  })
*/
  })
})
