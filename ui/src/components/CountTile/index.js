import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Col } from 'react-bootstrap'
import FontAwesome from 'react-fontawesome'
import classnames from 'classnames'
import { isEqual } from 'lodash'
import NumberFormat from 'react-number-format'

class CountTile extends Component {
  componentWillUpdate (nextProps) {
    return !isEqual(this.props, nextProps)
  }

  render () {
    return (
      <Col xs={this.props.size} className={classnames('add-top', this.props.extraClasses)}>
        <Col xs={12} style={{ opacity: this.props.opacity || 1 }} className={classnames('count-tile', this.props.color && this.props.color, this.props.txtcolor && `${this.props.txtcolor}-text`)}>
          <div>
            <h5 className='lightgray-text'>{this.props.subTitle}</h5>

            {(this.props.count === null) ? (<FontAwesome className='tierion-tealblue-text' name='gear' spin size='4x' />) : (<NumberFormat value={this.props.count} displayType={'text'} thousandSeparator renderText={value => <span className='count tierion-tealblue-text'>{value}</span>} />) }

            <h4 className='platinum-text'>{this.props.title}</h4>
          </div>
        </Col>
      </Col>
    )
  }
}

CountTile.propTypes = {
  size: PropTypes.number,
  color: PropTypes.string,
  title: PropTypes.string.isRequired
}

CountTile.defaultProps = {
  size: 3,
  extraClasses: ''
}

export default CountTile
