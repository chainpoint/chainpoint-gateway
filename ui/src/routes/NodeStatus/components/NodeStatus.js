import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid, Row, Col, FormGroup, ControlLabel, FormControl } from 'react-bootstrap'

class NodeStatus extends Component {
  componentWillMount () {
    this.props.getNodeConfig()
  }

  render () {
    return (
      <section>
        <Grid>
          <Row className='add-top'>
            <Col xs={10} xsOffset={2} className='add-top'>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Node Status</ControlLabel>
                <FormControl type='text' value={this.props.nodeConfig.version} placeholder='Node Version' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Node Version</ControlLabel>
                <FormControl type='text' value={this.props.nodeConfig.version} placeholder='Node Version' disabled />
              </FormGroup>
              <FormGroup controlId='formBasicText'>
                <ControlLabel>Node IP</ControlLabel>
                <FormControl type='text' value={this.props.nodeConfig.version} placeholder='Node Version' disabled />
              </FormGroup>
            </Col>
          </Row>
        </Grid>
      </section>
    )
  }
}

NodeStatus.propTypes = {
  nodeConfig: PropTypes.object,
  getNodeConfig: PropTypes.func.isRequired
}

NodeStatus.defaultProps = {
  nodeConfig: {}
}

export default NodeStatus
