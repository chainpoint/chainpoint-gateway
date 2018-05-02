import React, { Component } from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import { isUndefined as _isUndefined, isNull as _isNull, isNumber as _isNumber } from 'lodash'
import classnames from 'classnames'
import { Grid, Row, Col, FormGroup, ControlLabel, FormControl } from 'react-bootstrap'
import semver from 'semver'

class NodeStatus extends Component {
  constructor (props) {
    super(props)
    this._calculateAuditStatus = this._calculateAuditStatus.bind(this)
    this._calculateValidNPMVersion = this._calculateValidNPMVersion.bind(this)
    this._getNodeETHAddress = this._getNodeETHAddress.bind(this)
    this._calculateNTPDelta = this._calculateNTPDelta.bind(this)
    this._getTotalAuditsPassedAndFailed = this._getTotalAuditsPassedAndFailed.bind(this)
    this._getConsecutiveAuditsPassedAndFailed = this._getConsecutiveAuditsPassedAndFailed.bind(this)
    this._getTotalNodes = this._getTotalNodes.bind(this)
  }

  componentWillMount () {
    if (_isUndefined(this.props.auth.access_token)) {
      this.props.history.push('/login')
    }
  }

  componentDidMount () {
    this.props.getNodeConfig()
  }

  _calculateAuditStatus () {
    let passed = (this.props.nodeConfig.audits && this.props.nodeConfig.audits.length && this.props.nodeConfig.audits[0].audit_passed)

    return (passed) ? 'PASSED' : 'FAILED'
  }

  _calculateValidNPMVersion () {
    let version = (this.props.nodeConfig.audits && this.props.nodeConfig.audits.length) ? this.props.nodeConfig.audits[0].node_version : null

    try {
      let result = semver.gte(this.props.nodeConfig.version, version)

      return result
    } catch (_) {
      return false
    }
  }

  _getNodeETHAddress () {
    return (this.props.nodeConfig && this.props.nodeConfig.node && this.props.nodeConfig.node.tnt_addr) ? this.props.nodeConfig.node.tnt_addr : ''
  }

  _getNodePublicUri () {
    if (!(this.props.nodeConfig.audits && this.props.nodeConfig.audits.length)) return false

    if (_isNull(this.props.nodeConfig.audits[0].public_uri)) {
      return 'Private'
    } else {
      return this.props.nodeConfig.audits[0].public_uri
    }
  }

  _calculateNTPDelta () {
    if (this.props.nodeConfig.audits && this.props.nodeConfig.audits.length) {
      let val = (this.props.nodeConfig.audits[0].node_ms_delta) ? this.props.nodeConfig.audits[0].node_ms_delta : 0
      return [`${val}ms`, this.props.nodeConfig.audits[0].time_pass]
    } else {
      return []
    }
  }

  _getTotalAuditsPassedAndFailed () {
    if (this.props.nodeConfig && this.props.nodeConfig.node) {
      let passed = (_isNumber(this.props.nodeConfig.node.pass_count)) ? this.props.nodeConfig.node.pass_count : ''
      let failed = (_isNumber(this.props.nodeConfig.node.fail_count)) ? this.props.nodeConfig.node.fail_count : ''

      return [passed, failed]
    } else {
      return ['', '']
    }
  }

  _getConsecutiveAuditsPassedAndFailed () {
    if (this.props.nodeConfig && this.props.nodeConfig.node) {
      let passed = (_isNumber(this.props.nodeConfig.node.consecutive_passes)) ? this.props.nodeConfig.node.consecutive_passes : ''
      let failed = (_isNumber(this.props.nodeConfig.node.consecutive_fails)) ? this.props.nodeConfig.node.consecutive_fails : ''

      return [passed, failed]
    } else {
      return ['', '']
    }
  }

  _getTotalNodes () {
    return (this.props.nodeConfig && this.props.nodeConfig.core) ? this.props.nodeConfig.core.total_active_nodes : ''
  }

  render () {
    let auditStatus = this._calculateAuditStatus()
    let npmVersion = this._calculateValidNPMVersion()
    let publicUri = this._getNodePublicUri()
    let tnt_addr = this._getNodeETHAddress() // eslint-disable-line
    let [ntpDeltaVal, ntpDeltaBool] = this._calculateNTPDelta()
    let [totalAuditsPassed, totalAuditsFailed] = this._getTotalAuditsPassedAndFailed()
    let [consecutiveAuditsPassed, consecutiveAuditsFailed] = this._getConsecutiveAuditsPassedAndFailed()
    let totalNodes = this._getTotalNodes()
    let dataFromCoreLastReceived = (() => { // eslint-disable-line
      if (this.props.nodeConfig && this.props.nodeConfig.dataFromCoreLastReceived) {
        return moment(parseInt(this.props.nodeConfig.dataFromCoreLastReceived, 10)).utc().format()
      } else {
        return ''
      }
    })()

    return (
      <section>
        <Grid fluid>
          <Row className='add-top add-bottom'>
            <Col xs={10} xsOffset={1} className='add-top'>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Registration Status</ControlLabel>
                <FormControl type='text' value={this.props.nodeConfig.version} placeholder='Registration Status' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Audit Status</ControlLabel>
                <FormControl className={classnames({ 'green-text-important': auditStatus === 'PASSED', 'red-text-important': auditStatus === 'FAILED' })} type='text' value={(auditStatus === 'PASSED') ? 'Passed Last Audit' : 'Failed Last Audit'} placeholder='Audit Status' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Node Version</ControlLabel>
                <FormControl className={classnames({'green-text-important': npmVersion, 'red-text-important': !npmVersion})} type='text' value={(npmVersion) ? this.props.nodeConfig.version : `${this.props.nodeConfig.version} - upgrade available`} placeholder='Node Version' disabled />
              </FormGroup>
              {(publicUri !== false) && (<FormGroup controlId='formBasicText'>
                <ControlLabel>Node Public URI</ControlLabel>
                <FormControl type='text' value={publicUri} placeholder='Node Public URI' disabled />
              </FormGroup>)}
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Node TNT Address</ControlLabel>
                <FormControl type='text' value={tnt_addr} placeholder='Node TNT Address' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>NTP Time Delta</ControlLabel>
                <FormControl className={classnames({'green-text-important': ntpDeltaBool, 'red-text-important': !ntpDeltaBool})} type='text' value={ntpDeltaVal} placeholder='NTP Time Delta' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Total Audits Passed</ControlLabel>
                <FormControl type='text' value={totalAuditsPassed} placeholder='Total Audits Passed' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Total Audits Failed</ControlLabel>
                <FormControl type='text' value={totalAuditsFailed} placeholder='Total Audits Failed' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Consecutive Audits Passed</ControlLabel>
                <FormControl type='text' value={consecutiveAuditsPassed} placeholder='Consecutive Audits Passed' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Consecutive Audits Failed</ControlLabel>
                <FormControl type='text' value={consecutiveAuditsFailed} placeholder='Consecutive Audits Failed' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Total Nodes</ControlLabel>
                <FormControl type='text' value={totalNodes} placeholder='Total Nodes' disabled />
              </FormGroup>
            </Col>
            <Col className='center-align add-top add-bottom' xs={12}>
              <span className='add-top add-bottom darkgray-text'>Last Updated: {dataFromCoreLastReceived}</span>
            </Col>
          </Row>
        </Grid>
      </section>
    )
  }
}

NodeStatus.propTypes = {
  nodeConfig: PropTypes.object,
  auth: PropTypes.object,
  getNodeConfig: PropTypes.func.isRequired
}

NodeStatus.defaultProps = {
  nodeConfig: {},
  auth: {}
}

export default NodeStatus
