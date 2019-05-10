/* global describe, it, before */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const repChain = require('../lib/rep-chain.js')
const crypto = require('crypto')
const ethers = require('ethers')

describe('Reputation Chain Methods', () => {
  describe('startRepInterval', () => {
    before(() => {
      repChain.setENV({ PRIVATE_NETWORK: false })
    })
    it('should initiate interval as expected', async () => {
      let interval = repChain.startRepInterval()
      expect(interval).to.be.a('object')
      clearInterval(interval)
    })
  })

  describe('initializeNewRepItemAsync genesis', () => {
    before(() => {
      repChain.setCores({
        getLatestCalBlockInfoAsync: () => {
          return {
            latest_block_hash: 'latest_block_hash0'
          }
        }
      })
      repChain.setRocksDB({ getMostRecentReputationItemAsync: () => null })
      repChain.setENV({ PRIVATE_NETWORK: false })
    })
    it('should return new genesis rep item', async () => {
      let item = await repChain.initializeNewRepItemAsync()
      expect(item).to.be.a('object')
      expect(item)
        .to.have.property('id')
        .and.to.be.a('number')
        .and.to.equal(0)
      expect(item)
        .to.have.property('calBlockHeight')
        .and.to.be.a('number')
        .and.to.equal(0)
      expect(item)
        .to.have.property('calBlockHash')
        .and.to.be.a('string')
        .and.to.equal('latest_block_hash0')
      expect(item)
        .to.have.property('prevRepItemHash')
        .and.to.be.a('string')
        .and.to.equal('0000000000000000000000000000000000000000000000000000000000000000')
    })
  })

  describe('initializeNewRepItemAsync subsequent', () => {
    before(() => {
      repChain.setCores({
        getLatestCalBlockInfoAsync: () => {
          return {
            latest_block_height: 1,
            latest_block_hash: 'latest_block_hash1'
          }
        }
      })
      repChain.setRocksDB({
        getMostRecentReputationItemAsync: () => {
          return {
            id: 0,
            repItemHash: 'repItemHash'
          }
        }
      })
      repChain.setENV({ PRIVATE_NETWORK: false })
    })
    it('should return new non-genesis rep item', async () => {
      let item = await repChain.initializeNewRepItemAsync()
      expect(item).to.be.a('object')
      expect(item)
        .to.have.property('id')
        .and.to.be.a('number')
        .and.to.equal(1)
      expect(item)
        .to.have.property('calBlockHeight')
        .and.to.be.a('number')
        .and.to.equal(1)
      expect(item)
        .to.have.property('calBlockHash')
        .and.to.be.a('string')
        .and.to.equal('latest_block_hash1')
      expect(item)
        .to.have.property('prevRepItemHash')
        .and.to.be.a('string')
        .and.to.equal('repItemHash')
    })
  })

  describe('submitHashToSelfAsync', () => {
    let hashIdNode = '3de6d66e-4bd8-11e9-8646-d663bd873d93'
    let hintTime = new Date().toISOString()
    before(() => {
      repChain.setRP(async options => {
        switch (options.body.hashes[0]) {
          case 'deadbeefcafe':
            return { meta: { processing_hints: { cal: hintTime } }, hashes: [{ hash_id_node: hashIdNode }] }
          default:
            return { meta: { bad: 0 }, hashes: [] }
        }
      })
      repChain.setENV({ PRIVATE_NETWORK: false })
    })
    it('should throw the expected error on failure', async () => {
      let hash = 'error'
      let err = null
      try {
        await repChain.submitHashToSelfAsync(hash)
      } catch (error) {
        err = error
      }
      expect(err).to.not.equal(null)
      expect(err)
        .to.be.a('string')
        .and.to.equal('Bad response received from POST request to self')
    })
    it('should return the expected result on success', async () => {
      let hash = 'deadbeefcafe'
      let result = await repChain.submitHashToSelfAsync(hash)
      expect(result).to.be.a('object')
      expect(result)
        .to.have.property('hashIdNode')
        .and.to.equal(hashIdNode)
      expect(result)
        .to.have.property('calHint')
        .and.to.equal(hintTime)
    })
  })

  describe('calculateReputationItemSignatureAsync', () => {
    let ETH_ADDR = '0x01aCEe568C0f71E88C383B520Ac4e5752249e334'
    let ETH_PK = '0xc7bf6cecfc996d68f320dc5e384322ee8b985a7f940b4aafb07fb5b5b2285b51'
    let hashToSign = crypto.randomBytes(32).toString('hex')
    before(() => {
      repChain.setENV({
        NODE_ETH_ADDRESS: ETH_ADDR,
        NODE_ETH_PRIVATE_KEY: ETH_PK,
        PRIVATE_NETWORK: false
      })
    })
    it('should verifiably sign message using ETH private key as expected', async () => {
      let sig = await repChain.calculateReputationItemSignatureAsync(hashToSign)
      expect(sig).to.be.a('string')
      let signer = ethers.utils.verifyMessage(Buffer.from(hashToSign, 'hex'), sig)
      expect(signer)
        .to.be.a('string')
        .and.to.equal(ETH_ADDR)
    })
  })

  describe('calculateReputationItemHash', () => {
    let repItemSample = {
      id: 34559,
      calBlockHeight: 765756,
      calBlockHash: '9cab80484288b0467044600111c823d8a67bd3bba9063c9b7bb6ddd6f506baf2',
      prevRepItemHash: 'd6f253786233e9ee0e91f894cc51d7c79a5455dbc7ee509c5b9ca7bc669e02c1',
      hashIdNode: '3de6d66e-4bd8-11e9-8646-d663bd873d93'
    }
    it('should calculate the expected hash', async () => {
      let hash = repChain.calculateReputationItemHash(repItemSample)
      expect(hash)
        .to.be.a('string')
        .and.to.equal('c9ee7f0b005eb6ef26dc09eb1c99f0402ef2fdb3acd214634e8b70a21bcab465')
    })
  })

  describe('retrieveAndStoreProofAsync', () => {
    let saveId, saveProof
    let data = { data: 0 }
    before(() => {
      repChain.setRP(async () => {
        return [{ proof: data }]
      })
      repChain.setRocksDB({
        saveReputationItemProofAsync: (id, proof) => {
          saveId = id
          saveProof = proof
        }
      })
    })
    it('should store the expected value', async () => {
      let id = 123
      let hashIdNode = '3de6d66e-4bd8-11e9-8646-d663bd873d93'
      await repChain.retrieveAndStoreProofAsync(id, hashIdNode)
      expect(saveId)
        .to.be.a('number')
        .and.to.equal(id)
      expect(saveProof)
        .to.be.a('string')
        .and.to.equal(JSON.stringify(data))
    })
  })

  describe('generateReputationEntryAsync', () => {
    let ETH_ADDR = '0x01aCEe568C0f71E88C383B520Ac4e5752249e334'
    let ETH_PK = '0xc7bf6cecfc996d68f320dc5e384322ee8b985a7f940b4aafb07fb5b5b2285b51'
    let hashIdNode = '3de6d66e-4bd8-11e9-8646-d663bd873d93'
    let hintTime = new Date().toISOString()
    let saveId, saveProof, saveItem
    let data = { data: 0 }
    let repItemHash = 'c9ee7f0b005eb6ef26dc09eb1c99f0402ef2fdb3acd214634e8b70a21bcab465'
    before(() => {
      repChain.setCores({
        getLatestCalBlockInfoAsync: () => {
          return {
            latest_block_height: 765756,
            latest_block_hash: '9cab80484288b0467044600111c823d8a67bd3bba9063c9b7bb6ddd6f506baf2'
          }
        }
      })
      repChain.setRocksDB({
        getMostRecentReputationItemAsync: () => {
          return {
            id: 34558,
            repItemHash: 'd6f253786233e9ee0e91f894cc51d7c79a5455dbc7ee509c5b9ca7bc669e02c1'
          }
        },
        saveReputationItemProofAsync: (id, proof) => {
          saveId = id
          saveProof = proof
        },
        saveReputationItemAsync: newRepItem => {
          saveItem = newRepItem
        }
      })
      repChain.setRP(async options => {
        switch (options.method) {
          case 'POST':
            return { meta: { processing_hints: { cal: hintTime } }, hashes: [{ hash_id_node: hashIdNode }] }
          case 'GET':
            return [{ proof: data }]
          default:
            return null
        }
      })
      repChain.setENV({
        NODE_ETH_ADDRESS: ETH_ADDR,
        NODE_ETH_PRIVATE_KEY: ETH_PK,
        PRIVATE_NETWORK: false
      })
    })
    it('should generate and store new item as expected', async () => {
      await repChain.generateReputationEntryAsync()
      expect(saveId).to.equal(34559)
      expect(saveProof).to.equal(JSON.stringify(data))
      expect(saveItem).to.be.a('object')
      expect(saveItem)
        .to.have.property('id')
        .and.to.equal(34559)
      expect(saveItem)
        .to.have.property('calBlockHeight')
        .and.to.equal(765756)
      expect(saveItem)
        .to.have.property('calBlockHash')
        .and.to.equal('9cab80484288b0467044600111c823d8a67bd3bba9063c9b7bb6ddd6f506baf2')
      expect(saveItem)
        .to.have.property('prevRepItemHash')
        .and.to.equal('d6f253786233e9ee0e91f894cc51d7c79a5455dbc7ee509c5b9ca7bc669e02c1')
      expect(saveItem)
        .to.have.property('hashIdNode')
        .and.to.equal(hashIdNode)
      expect(saveItem)
        .to.have.property('repItemHash')
        .and.to.equal(repItemHash)
      expect(saveItem).to.have.property('signature')
      expect(saveItem.signature).to.be.a('string')
      let signer = ethers.utils.verifyMessage(Buffer.from(repItemHash, 'hex'), saveItem.signature)
      expect(signer).to.equal(ETH_ADDR)
    })
  })
})
