/* global describe, it beforeEach, afterEach */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect
const request = require('supertest')

const app = require('../lib/api-server.js')
const calendar = require('../lib/endpoints/calendar.js')

describe('Calendar Controller', () => {
  let txIdKnown = '52af6b21e7b370f680e984b8a1e34ffdb45770d3cf599357ce245bad8c820d50'
  let txKnownData = { tx: { data: 'data!' } }
  let insecureServer = null
  beforeEach(async () => {
    insecureServer = await app.startInsecureRestifyServerAsync()
    calendar.setCores({
      getCachedTransactionAsync: txId => {
        if (txId === txIdKnown) return txKnownData
        return null
      }
    })
  })
  afterEach(() => {
    insecureServer.close()
  })

  describe('GET /calendar/:txId/data', () => {
    it('should return the proper error with non hex txId', done => {
      request(insecureServer)
        .get('/calendar/nothex/data')
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
            .and.to.equal('invalid JSON body, invalid txId present')
          done()
        })
    })

    it('should return the proper error with hex txId -- short', done => {
      request(insecureServer)
        .get('/calendar/52af6b21e7b370f680e984b8a1e34ffdb45770d3cf599357ce245bad8c820d/data')
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
            .and.to.equal('invalid JSON body, invalid txId present')
          done()
        })
    })

    it('should return the proper error with hex txId -- long', done => {
      request(insecureServer)
        .get('/calendar/52af6b21e7b370f680e984b8a1e34ffdb45770d3cf599357ce245bad8c820d5050/data')
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
            .and.to.equal('invalid JSON body, invalid txId present')
          done()
        })
    })

    it('should return the proper error with valid, not found', done => {
      request(insecureServer)
        .get('/calendar/52af6b21e7b370f680e984b8a1e34ffdb45770d3cf599357ce245bad8c820d51/data')
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

    it('should return the proper result on success', done => {
      request(insecureServer)
        .get('/calendar/' + txIdKnown + '/data')
        .expect('Content-type', /text/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.text).to.equal(txKnownData.tx.data)
          done()
        })
    })
  })
})
