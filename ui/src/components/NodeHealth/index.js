import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Col } from 'react-bootstrap'
import classnames from 'classnames'
import FontAwesome from 'react-fontawesome'

class NodeHealth extends Component {
  render () {
    let health = { healthLabel: '', healthIcon: 'gear' }
    switch (this.props.health) {
      case 'healthy':
        health = { healthLabel: 'Node is healthy.', healthIcon: 'check-circle' }
        break
      case 'tainted':
        health = { healthLabel: 'Node is experiencing technical difficulties.', healthIcon: 'info-circle' }
        break
      case 'failing':
        health = { healthLabel: 'Node is experiencing technical difficulties.', healthIcon: 'times-circle' }
        break
      default:
        health = { healthLabel: '', healthIcon: '' }
        break
    }
    return (
      <Col xs={12}>
        <Col xs={12} className={classnames('tile', 'node-health-tile', 'center-align', {
          'greentea': this.props.health === 'healthy',
          'mustard': this.props.health === 'tainted',
          'firebrick': this.props.health === 'failing',
          'platinum': this.props.health === 'info'
        })}>
          <span className='health-icon'>
            {health.healthIcon && <FontAwesome name={health.healthIcon} size='5x' />}
            <h4 className='add-top no-margin-bottom no-padding-bottom'>{health.healthLabel}</h4>
          </span>
        </Col>
      </Col>
    )
  }
}

NodeHealth.propTypes = {
  health: PropTypes.string
}

export default NodeHealth
