/* global describe, it, beforeEach, afterEach */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect
const request = require('supertest')

const app = require('../lib/api-server.js')

const { version } = require('../package.json')

describe('Config Controller', () => {
  let insecureServer = null
  beforeEach(async () => {
    insecureServer = await app.startInsecureRestifyServerAsync()
  })
  afterEach(() => {
    insecureServer.close()
  })

  describe('GET /config', () => {
    it('should return a valid config object', done => {
      request(insecureServer)
        .get('/config')
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(Object.keys(res.body).length).to.equal(2)
          expect(res.body)
            .to.have.property('version')
            .and.to.be.a('string')
            .and.to.equal(version)
          expect(res.body)
            .to.have.property('time')
            .and.to.be.a('string')
          done()
        })
    })
  })
})
