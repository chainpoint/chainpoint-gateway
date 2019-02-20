/* global describe, it beforeEach, afterEach */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect
const request = require('supertest')
const fs = require('fs')

const app = require('../lib/api-server.js')
const proofs = require('../lib/endpoints/proofs.js')

describe('Proofs Controller', () => {
  let insecureServer = null
  beforeEach(async () => {
    insecureServer = await app.startInsecureRestifyServerAsync()
    proofs.setEventMetrics({
      captureEvent: () => {}
    })
    proofs.setRocksDB({
      getProofStatesBatchByHashIdNodesAsync: async hashIds => {
        switch (hashIds[0]) {
          case 'bbb27662-2e21-11e9-b210-d663bd873d93':
            return [
              {
                hashIdNode: hashIds[0],
                hash: '18af1184ae64160f8a4019f43ddc825db95f11a0e468f8da6cb9f8bbe1dbd784',
                proofState: [],
                hashIdCore: '000139a0-2e5c-11e9-bec9-01115ea738e6'
              }
            ]
          default:
            return [
              {
                hashIdNode: hashIds[0],
                hash: null,
                proofState: null,
                hashIdCore: null
              }
            ]
        }
      }
    })
    proofs.setCachedProofs({
      getCachedCoreProofsAsync: async hashIdCores => {
        switch (hashIdCores[0]) {
          case '000139a0-2e5c-11e9-bec9-01115ea738e6': {
            let proofJSON = fs.readFileSync('./tests/sample-data/core-btc-proof.chp.json')
            return [
              {
                hash_id: hashIdCores[0],
                proof: JSON.parse(proofJSON),
                anchorsComplete: ['cal', 'btc']
              }
            ]
          }
          default:
            return []
        }
      }
    })
    proofs.setENV({ GET_PROOFS_MAX_REST: 1 })
  })
  afterEach(() => {
    insecureServer.close()
  })

  describe('GET /proofs', () => {
    it('should return the proper error with bad hash_id in uri', done => {
      request(insecureServer)
        .get('/proofs/badhashid')
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
            .and.to.equal('invalid request, bad hash_id')
          done()
        })
    })

    it('should return the proper error with no hash ids', done => {
      request(insecureServer)
        .get('/proofs')
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
            .and.to.equal('invalid request, at least one hash id required')
          done()
        })
    })

    it('should return the proper error with too many hash_ids', done => {
      request(insecureServer)
        .get('/proofs')
        .set('hashids', 'a3127662-2e21-11e9-b210-d663bd873d93,a3127662-2e21-11e9-b210-d663bd873d99')
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
            .and.to.equal('invalid request, too many hash ids (1 max)')
          done()
        })
    })

    it('should return the proper error with invalid hash_id in header', done => {
      request(insecureServer)
        .get('/proofs')
        .set('hashids', 'invalid')
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
            .and.to.equal('invalid request, bad hash_id')
          done()
        })
    })

    it('should return the proper empty result with unknown hash_id', done => {
      let hashId = 'a3127662-2e21-11e9-b210-d663bd873d93'
      request(insecureServer)
        .get('/proofs')
        .set('hashids', hashId)
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body).to.have.length(1)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(hashId)
          expect(res.body[0])
            .to.have.property('proof')
            .and.to.equal(null)
          expect(res.body[0])
            .to.have.property('anchors_complete')
            .and.to.be.a('array')
          expect(res.body[0].anchors_complete).to.have.length(0)
          done()
        })
    })

    it('should return successfully with a base64 proof with no Accept setting', done => {
      let hashId = 'bbb27662-2e21-11e9-b210-d663bd873d93'
      request(insecureServer)
        .get('/proofs')
        .set('hashids', hashId)
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body).to.have.length(1)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(hashId)
          expect(res.body[0])
            .to.have.property('proof')
            .and.to.be.a('string')
          expect(res.body[0])
            .to.have.property('anchors_complete')
            .and.to.be.a('array')
          expect(res.body[0].anchors_complete).to.have.length(2)
          expect(res.body[0].anchors_complete[0])
            .to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors_complete[1])
            .to.be.a('string')
            .and.to.equal('btc')
          done()
        })
    })

    it('should return successfully with a base64 proof with Accept Base64 setting', done => {
      let hashId = 'bbb27662-2e21-11e9-b210-d663bd873d93'
      request(insecureServer)
        .get('/proofs')
        .set('hashids', hashId)
        .set('Accept', 'application/vnd.chainpoint.json+base64')
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body).to.have.length(1)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(hashId)
          expect(res.body[0])
            .to.have.property('proof')
            .and.to.be.a('string')
          expect(res.body[0])
            .to.have.property('anchors_complete')
            .and.to.be.a('array')
          expect(res.body[0].anchors_complete).to.have.length(2)
          expect(res.body[0].anchors_complete[0])
            .to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors_complete[1])
            .to.be.a('string')
            .and.to.equal('btc')
          done()
        })
    })

    it('should return successfully with a JSON proof with Accept JSON setting', done => {
      let hashId = 'bbb27662-2e21-11e9-b210-d663bd873d93'
      request(insecureServer)
        .get('/proofs')
        .set('hashids', hashId)
        .set('Accept', 'application/vnd.chainpoint.ld+json')
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body).to.have.length(1)
          expect(res.body[0])
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(hashId)
          expect(res.body[0]).to.have.property('proof')
          expect(res.body[0].proof)
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal('18af1184ae64160f8a4019f43ddc825db95f11a0e468f8da6cb9f8bbe1dbd784')
          expect(res.body[0].proof)
            .to.have.property('hash_id_node')
            .and.to.be.a('string')
            .and.to.equal(hashId)
          expect(res.body[0].proof)
            .to.have.property('hash_id_core')
            .and.to.be.a('string')
            .and.to.equal('000139a0-2e5c-11e9-bec9-01115ea738e6')
          expect(res.body[0])
            .to.have.property('anchors_complete')
            .and.to.be.a('array')
          expect(res.body[0].anchors_complete).to.have.length(2)
          expect(res.body[0].anchors_complete[0])
            .to.be.a('string')
            .and.to.equal('cal')
          expect(res.body[0].anchors_complete[1])
            .to.be.a('string')
            .and.to.equal('btc')
          done()
        })
    })
  })
})
