/* global describe, it, beforeEach, before */

process.env.NODE_ENV = 'test'

// test related packages
const expect = require('chai').expect

const apiServer = require('../lib/api-server.js')

let rocksData = {}
const TOR_IPS_KEY = 'blacklist:tor:ips'

describe('API Server Methods', () => {
  beforeEach(() => {
    apiServer.setRocksDB({
      getAsync: async key => rocksData[key],
      setAsync: async (key, value) => {
        rocksData[key] = value.toString()
      }
    })
  })

  describe('startIPBlacklistRefreshInterval', () => {
    it('should initiate interval as expected', async () => {
      let interval = apiServer.startIPBlacklistRefreshInterval()
      expect(interval).to.be.a('object')
      clearInterval(interval)
    })
  })

  describe('refreshIPBlacklistAsync with tor request failure, cache read failure', () => {
    before(() => {
      apiServer.setRP(async () => {
        throw 'bad'
      })
      apiServer.setRocksDB(null)
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(0)
    })
  })

  describe('refreshIPBlacklistAsync with tor request failure, empty cache', () => {
    before(() => {
      apiServer.setRP(async () => {
        throw 'bad'
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(0)
    })
  })

  describe('refreshIPBlacklistAsync with tor request failure, cache present', () => {
    before(() => {
      apiServer.setRP(async () => {
        throw 'bad'
      })
      rocksData[TOR_IPS_KEY] = '65.1.1.1,202.10.0.12'
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(2)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('65.1.1.1')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('202.10.0.12')
    })
  })

  describe('refreshIPBlacklistAsync with tor request success, cache write failure', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
      apiServer.setRocksDB(null)
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(2)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
    })
  })

  describe('refreshIPBlacklistAsync with tor request success, cache write success', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(2)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
    })
  })

  describe('refreshIPBlacklistAsync with tor request success, no local list', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
      apiServer.setFS({
        existsSync: () => false
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(2)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
    })
  })

  describe('refreshIPBlacklistAsync with tor request success, empty local list', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
      apiServer.setFS({
        existsSync: () => true,
        readFileSync: () => ''
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(2)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
    })
  })

  describe('refreshIPBlacklistAsync with tor request success, malformatted local list', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
      apiServer.setFS({
        existsSync: () => true,
        readFileSync: () => 'these arent IPs!'
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(2)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
    })
  })

  describe('refreshIPBlacklistAsync with tor request success, semi-malformatted local list', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
      apiServer.setFS({
        existsSync: () => true,
        readFileSync: () => '162.247.74.202\ninvalid'
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(3)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
      expect(ips[2])
        .to.be.a('string')
        .and.to.equal('162.247.74.202')
    })
  })

  describe('refreshIPBlacklistAsync with tor request success, semi-duplicate local list', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
      apiServer.setFS({
        existsSync: () => true,
        readFileSync: () => '162.247.74.201\ninvalid'
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(2)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
    })
  })

  describe('refreshIPBlacklistAsync with tor request success, semi-commented local list', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
      apiServer.setFS({
        existsSync: () => true,
        readFileSync: () => '162.247.74.204\n#67.1.1.1'
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(3)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
      expect(ips[2])
        .to.be.a('string')
        .and.to.equal('162.247.74.204')
    })
  })

  describe('refreshIPBlacklistAsync with tor request success, IPv6 local list', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
      apiServer.setFS({
        existsSync: () => true,
        readFileSync: () => '::ffff:172.18.0.1'
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(3)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
      expect(ips[2])
        .to.be.a('string')
        .and.to.equal('::ffff:172.18.0.1')
    })
  })

  describe('refreshIPBlacklistAsync with full tor request success, good local list', () => {
    before(() => {
      apiServer.setRP(async () => {
        return 'ExitNode 0011BD2485AD45D984EC4159C88FC066E5E3300E\nPublished 2019-02-17 23:51:28\nLastStatus 2019-02-18 01:18:34\nExitAddress 162.247.74.201 2019-02-18 01:22:36\nExitNode 003D78825E0B9609EECFF5E4E0529717772E53C7\nPublished 2019-02-18 14:56:19\nLastStatus 2019-02-18 16:02:35\nExitAddress 104.218.63.73 2019-02-18 16:07:38'
      })
      apiServer.setFS({
        existsSync: () => true,
        readFileSync: () => '65.1.1.1\n65.2.2.2\n65.3.3.3'
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(5)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('162.247.74.201')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('104.218.63.73')
      expect(ips[2])
        .to.be.a('string')
        .and.to.equal('65.1.1.1')
      expect(ips[3])
        .to.be.a('string')
        .and.to.equal('65.2.2.2')
      expect(ips[4])
        .to.be.a('string')
        .and.to.equal('65.3.3.3')
    })
  })

  describe('refreshIPBlacklistAsync with empty tor request success, good local list', () => {
    before(() => {
      apiServer.setRP(async () => {
        return ''
      })
      apiServer.setFS({
        existsSync: () => true,
        readFileSync: () => '65.1.1.1\n65.2.2.2\n65.3.3.3'
      })
    })
    it('should return expected value', async () => {
      let ips = await apiServer.refreshIPBlacklistAsync()
      expect(ips).to.be.a('array')
      expect(ips.length).to.equal(3)
      expect(ips[0])
        .to.be.a('string')
        .and.to.equal('65.1.1.1')
      expect(ips[1])
        .to.be.a('string')
        .and.to.equal('65.2.2.2')
      expect(ips[2])
        .to.be.a('string')
        .and.to.equal('65.3.3.3')
    })
  })
})
