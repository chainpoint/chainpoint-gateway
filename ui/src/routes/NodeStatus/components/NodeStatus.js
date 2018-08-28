import React, { Component } from 'react'
import PropTypes from 'prop-types'
import moment from 'moment'
import {
  isNull as _isNull,
  isNumber as _isNumber,
  isEmpty as _isEmpty
} from 'lodash'
import classnames from 'classnames'
import {
  Grid,
  Row,
  Col,
  FormGroup,
  ControlLabel,
  FormControl
} from 'react-bootstrap'
import semver from 'semver'

class NodeStatus extends Component {
  constructor(props) {
    super(props)
    this._getRegistrationStatus = this._getRegistrationStatus.bind(this)
    this._calculateAuditStatus = this._calculateAuditStatus.bind(this)
    this._calculateValidNPMVersion = this._calculateValidNPMVersion.bind(this)
    this._getNodeETHAddress = this._getNodeETHAddress.bind(this)
    this._calculateNTPDelta = this._calculateNTPDelta.bind(this)
    this._getTotalAuditsPassedAndFailed = this._getTotalAuditsPassedAndFailed.bind(
      this
    )
    this._getConsecutiveAuditsPassedAndFailed = this._getConsecutiveAuditsPassedAndFailed.bind(
      this
    )
    this._getTotalNodes = this._getTotalNodes.bind(this)

    this.state = { node_min_version: null }
  }

  componentDidMount() {
    fetch('https://a.chainpoint.org/config')
      .then(res => res.json())
      .then(res => {
        // eslint-disable-line
        this.setState({
          node_min_version: res.node_min_version
        })
      })

    this.props.getNodeConfig()
    this.props.getNodeStats('last_1_days')

    this.statsInterval = setInterval(() => {
      // Provide near real-time information
      this.props.getNodeStats('last_1_days')
    }, 1000)
  }

  componentWillUnmount() {
    clearInterval(this.statsInterval)
  }

  _getRegistrationStatus() {
    return this.props.nodeData.node_registered
  }

  _getRegistrationStatusText(status, publicUri) {
    if (status === false) return 'Unregistered'
    else if (
      status === true &&
      (_isEmpty(publicUri) || publicUri === 'http://0.0.0.0')
    )
      return 'Private'
    else if (status === true && publicUri !== null) return 'Registered'
    else return 'Unregistered'
  }

  _calculateAuditStatus() {
    if (!(this.props.nodeData.audits && this.props.nodeData.audits.length))
      return ''

    let passed =
      this.props.nodeData.audits &&
      this.props.nodeData.audits.length &&
      this.props.nodeData.audits[0].audit_passed

    return passed ? 'PASSED' : 'FAILED'
  }

  _calculateValidNPMVersion() {
    if (!(this.props.nodeConfig.version && this.state.node_min_version))
      return ''

    try {
      let result = semver.gte(
        this.props.nodeConfig.version,
        this.state.node_min_version
      )

      return result
    } catch (_) {
      return false
    }
  }

  _getNodeETHAddress() {
    return this.props.nodeData &&
      this.props.nodeData.node &&
      this.props.nodeData.node.node_tnt_addr
      ? this.props.nodeData.node.node_tnt_addr
      : ''
  }

  _getNodePublicUri() {
    if (_isEmpty(this.props.nodeData.node_public_uri)) return 'Private'
    else if (!(this.props.nodeData.audits && this.props.nodeData.audits.length))
      return ''

    if (_isNull(this.props.nodeData.audits[0].public_uri)) {
      return 'Private'
    } else {
      return this.props.nodeData.audits[0].public_uri
    }
  }

  _calculateNTPDelta() {
    if (
      this.props.nodeData.audits &&
      this.props.nodeData.audits.length &&
      _isNumber(this.props.nodeData.audits[0].node_ms_delta)
    ) {
      let val = this.props.nodeData.audits[0].node_ms_delta
      return [`${val}ms`, this.props.nodeData.audits[0].time_pass]
    } else {
      return ['', '']
    }
  }

  _getTotalAuditsPassedAndFailed() {
    if (this.props.nodeData && this.props.nodeData.node) {
      let passed = _isNumber(this.props.nodeData.node.pass_count)
        ? this.props.nodeData.node.pass_count
        : ''
      let failed = _isNumber(this.props.nodeData.node.fail_count)
        ? this.props.nodeData.node.fail_count
        : ''

      return [passed, failed]
    } else {
      return ['', '']
    }
  }

  _getConsecutiveAuditsPassedAndFailed() {
    if (this.props.nodeData && this.props.nodeData.node) {
      let passed = _isNumber(this.props.nodeData.node.consecutive_passes)
        ? this.props.nodeData.node.consecutive_passes
        : ''
      let failed = _isNumber(this.props.nodeData.node.consecutive_fails)
        ? this.props.nodeData.node.consecutive_fails
        : ''

      return [passed, failed]
    } else {
      return ['', '']
    }
  }

  _getTotalNodes() {
    return this.props.nodeData && this.props.nodeData.core
      ? this.props.nodeData.core.total_active_nodes
      : ''
  }

  render() {
    let registrationStatus = this._getRegistrationStatus()
    let auditStatus = this._calculateAuditStatus()
    let npmVersion = this._calculateValidNPMVersion()
    let publicUri = this._getNodePublicUri()
    let tnt_addr = this._getNodeETHAddress() // eslint-disable-line
    let [ntpDeltaVal, ntpDeltaBool] = this._calculateNTPDelta()
    let [
      totalAuditsPassed,
      totalAuditsFailed
    ] = this._getTotalAuditsPassedAndFailed()
    let [
      consecutiveAuditsPassed,
      consecutiveAuditsFailed
    ] = this._getConsecutiveAuditsPassedAndFailed()
    let totalNodes = this._getTotalNodes()
    let registrationStatusText = this._getRegistrationStatusText(
      registrationStatus,
      this.props.nodeData.node_public_uri
    )
    let nodeIsPrivate =
      registrationStatus &&
      (_isEmpty(this.props.nodeData.node_public_uri) ||
        this.props.nodeData.node_public_uri === 'http://0.0.0.0')
    let dataFromCoreLastReceived = (() => {
      // eslint-disable-line
      if (this.props.nodeData && this.props.nodeData.dataFromCoreLastReceived) {
        return moment(
          parseInt(this.props.nodeData.dataFromCoreLastReceived, 10)
        )
          .utc()
          .format()
      } else {
        return ''
      }
    })()

    return (
      <section className="about-view-wrapper">
        <Grid fluid>
          <Row className="add-top add-bottom">
            <Col xs={10} xsOffset={1} className="add-top">
              <FormGroup
                className={classnames({
                  hide: this.props.nodeData.node_registered === ''
                })}
                controlId="formBasicText"
              >
                <ControlLabel>Registration Status</ControlLabel>
                <FormControl
                  className={classnames({
                    'green-text-important': registrationStatus,
                    'red-text-important': !registrationStatus
                  })}
                  type="text"
                  value={registrationStatusText}
                  placeholder="Registration Status"
                  disabled
                />
              </FormGroup>
              <FormGroup
                className={classnames({
                  hide: nodeIsPrivate || auditStatus === ''
                })}
                controlId="formBasicText"
              >
                <ControlLabel>Audit Status</ControlLabel>
                <FormControl
                  className={classnames({
                    'green-text-important': auditStatus === 'PASSED',
                    'red-text-important': auditStatus === 'FAILED'
                  })}
                  type="text"
                  value={
                    auditStatus === 'PASSED'
                      ? 'Passed Last Audit'
                      : 'Failed Last Audit'
                  }
                  placeholder="Audit Status"
                  disabled
                />
              </FormGroup>
              <FormGroup
                className={classnames({ hide: npmVersion === '' })}
                controlId="formBasicText"
              >
                <ControlLabel>Node Version</ControlLabel>
                <FormControl
                  className={classnames({
                    'green-text-important': npmVersion,
                    'red-text-important': !npmVersion
                  })}
                  type="text"
                  value={
                    npmVersion
                      ? this.props.nodeConfig.version
                      : `${this.props.nodeConfig.version} - upgrade available`
                  }
                  placeholder="Node Version"
                  disabled
                />
              </FormGroup>
              {publicUri !== '' &&
                !nodeIsPrivate && (
                  <FormGroup controlId="formBasicText">
                    <ControlLabel>Node Public URI</ControlLabel>
                    <FormControl
                      type="text"
                      value={publicUri}
                      placeholder="Node Public URI"
                      disabled
                    />
                  </FormGroup>
                )}
              <FormGroup
                className={classnames({ hide: tnt_addr === '' })}
                controlId="formBasicText"
              >
                <ControlLabel>Node TNT Address</ControlLabel>
                <FormControl
                  type="text"
                  value={tnt_addr}
                  placeholder="Node TNT Address"
                  disabled
                />
              </FormGroup>
              <FormGroup
                className={classnames({
                  hide: nodeIsPrivate || ntpDeltaVal === ''
                })}
                controlId="formBasicText"
              >
                <ControlLabel>NTP Time Delta</ControlLabel>
                <FormControl
                  className={classnames({
                    'green-text-important': ntpDeltaBool,
                    'red-text-important':
                      !ntpDeltaBool ||
                      (ntpDeltaVal.split('ms')[0] > 5000 ||
                        ntpDeltaVal.split('ms')[0] < -5000)
                  })}
                  type="text"
                  value={ntpDeltaVal}
                  placeholder="NTP Time Delta"
                  disabled
                />
              </FormGroup>
              <FormGroup
                className={classnames({
                  hide: nodeIsPrivate || totalAuditsPassed === ''
                })}
                controlId="formBasicText"
              >
                <ControlLabel>Total Audits Passed</ControlLabel>
                <FormControl
                  type="text"
                  value={totalAuditsPassed}
                  placeholder="Total Audits Passed"
                  disabled
                />
              </FormGroup>
              <FormGroup
                className={classnames({
                  hide: nodeIsPrivate || totalAuditsFailed === ''
                })}
                controlId="formBasicText"
              >
                <ControlLabel>Total Audits Failed</ControlLabel>
                <FormControl
                  type="text"
                  value={totalAuditsFailed}
                  placeholder="Total Audits Failed"
                  disabled
                />
              </FormGroup>
              <FormGroup
                className={classnames({
                  hide: nodeIsPrivate || consecutiveAuditsPassed === ''
                })}
                controlId="formBasicText"
              >
                <ControlLabel>Consecutive Audits Passed</ControlLabel>
                <FormControl
                  type="text"
                  value={consecutiveAuditsPassed}
                  placeholder="Consecutive Audits Passed"
                  disabled
                />
              </FormGroup>
              <FormGroup
                className={classnames({
                  hide: nodeIsPrivate || consecutiveAuditsFailed === ''
                })}
                controlId="formBasicText"
              >
                <ControlLabel>Consecutive Audits Failed</ControlLabel>
                <FormControl
                  type="text"
                  value={consecutiveAuditsFailed}
                  placeholder="Consecutive Audits Failed"
                  disabled
                />
              </FormGroup>
              <FormGroup
                className={classnames({
                  hide: nodeIsPrivate || totalNodes === ''
                })}
                controlId="formBasicText"
              >
                <ControlLabel>Total Nodes</ControlLabel>
                <FormControl
                  type="text"
                  value={totalNodes}
                  placeholder="Total Nodes"
                  disabled
                />
              </FormGroup>
            </Col>
            <Col className="center-align add-top add-bottom" xs={12}>
              {dataFromCoreLastReceived && (
                <span className="add-top add-bottom darkgray-text">
                  Last Updated: {dataFromCoreLastReceived}
                </span>
              )}
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
  getNodeConfig: PropTypes.func.isRequired,
  getNodeStats: PropTypes.func,
  node: PropTypes.shape({
    stats: PropTypes.shape({
      last_1_days: PropTypes.any
    })
  }),
  nodeData: PropTypes.shape({
    node_registered: PropTypes.bool,
    audits: PropTypes.array,
    node_public_uri: PropTypes.string,
    core: PropTypes.any,
    dataFromCoreLastReceived: PropTypes.string,
    node: PropTypes.shape({
      node_tnt_addr: PropTypes.string,
      node_registered: PropTypes.bool,
      pass_count: PropTypes.number,
      fail_count: PropTypes.number,
      consecutive_fails: PropTypes.number,
      consecutive_passes: PropTypes.number
    })
  })
}

NodeStatus.defaultProps = {
  nodeConfig: {},
  nodeData: {},
  auth: {}
}

export default NodeStatus
