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
    proofs.setRocksDB({
      getProofStatesBatchByProofIdsAsync: async proofIds => {
        switch (proofIds[0]) {
          case 'bbb27662-2e21-11e9-b210-d663bd873d93':
            return [
              {
                proofId: proofIds[0],
                hash: '18af1184ae64160f8a4019f43ddc825db95f11a0e468f8da6cb9f8bbe1dbd784',
                proofState: [],
                submission: {
                  submitId: 'e4c59c50-37cd-11e9-b270-d778f1c6df42',
                  cores: [{ ip: '65.1.1.1', proofId: '000139a0-2e5c-11e9-bec9-01115ea738e6' }]
                }
              }
            ]
          default:
            return [
              {
                proofId: proofIds[0],
                hash: null,
                proofState: null,
                submission: null
              }
            ]
        }
      }
    })
    proofs.setCachedProofs({
      getCachedCoreProofsAsync: async submissionData => {
        if (submissionData.length === 0) return []
        switch (submissionData[0].submitId) {
          case 'e4c59c50-37cd-11e9-b270-d778f1c6df42': {
            let proofJSON = fs.readFileSync('./tests/sample-data/core-btc-proof.chp.json')
            return [
              {
                submitId: submissionData[0].submitId,
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
    proofs.setENV({ GET_PROOFS_MAX: 1 })
  })
  afterEach(() => {
    insecureServer.close()
  })

  describe('GET /proofs', () => {
    it('should return the proper error with bad hash_id in uri', done => {
      request(insecureServer)
        .get('/proofs/badproofid')
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
        .set('proofids', 'a3127662-2e21-11e9-b210-d663bd873d93,a3127662-2e21-11e9-b210-d663bd873d99')
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
        .set('proofids', 'invalid')
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
      let proofId = 'a3127662-2e21-11e9-b210-d663bd873d93'
      request(insecureServer)
        .get('/proofs')
        .set('proofids', proofId)
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body).to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_id')
            .and.to.be.a('string')
            .and.to.equal(proofId)
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
      let proofId = 'bbb27662-2e21-11e9-b210-d663bd873d93'
      request(insecureServer)
        .get('/proofs')
        .set('proofids', proofId)
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body).to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_id')
            .and.to.be.a('string')
            .and.to.equal(proofId)
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
      let proofId = 'bbb27662-2e21-11e9-b210-d663bd873d93'
      request(insecureServer)
        .get('/proofs')
        .set('proofids', proofId)
        .set('Accept', 'application/vnd.chainpoint.json+base64')
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body).to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_id')
            .and.to.be.a('string')
            .and.to.equal(proofId)
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
      let proofId = 'bbb27662-2e21-11e9-b210-d663bd873d93'
      request(insecureServer)
        .get('/proofs')
        .set('proofids', proofId)
        .set('Accept', 'application/vnd.chainpoint.ld+json')
        .expect('Content-type', /json/)
        .expect(200)
        .end((err, res) => {
          expect(err).to.equal(null)
          expect(res.body).to.be.a('array')
          expect(res.body).to.have.length(1)
          expect(res.body[0])
            .to.have.property('proof_id')
            .and.to.be.a('string')
            .and.to.equal(proofId)
          expect(res.body[0]).to.have.property('proof')
          expect(res.body[0].proof)
            .to.have.property('hash')
            .and.to.be.a('string')
            .and.to.equal('18af1184ae64160f8a4019f43ddc825db95f11a0e468f8da6cb9f8bbe1dbd784')
          expect(res.body[0].proof)
            .to.have.property('proof_id')
            .and.to.be.a('string')
            .and.to.equal(proofId)
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
