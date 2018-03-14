import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { isEqual } from 'lodash'
import FontAwesome from 'react-fontawesome'

class SideNav extends Component {
  componentWillUpdate (nextProps, nextState) {
    return !isEqual(this.props, nextProps)
  }

  render () {
    return (
      <div className='sidenav' style={{ width: this.props.menuOpen ? '300px' : '0px' }}>
        <span className='closebtn lightgray-text curosr' onClick={this.props.closeMenu}><FontAwesome className='lightgray-text' name='times' /></span>
        <Link to='/' onClick={this.props.closeMenu}><FontAwesome className='lightgray-text' name='signal' />&nbsp;&nbsp;Activity</Link>
        <Link to='/status' onClick={this.props.closeMenu}><FontAwesome className='lightgray-text' name='list' />&nbsp;&nbsp;Status</Link>
      </div>
    )
  }
}

SideNav.propTypes = {
  menuOpen: PropTypes.bool.isRequired,
  closeMenu: PropTypes.func.isRequired
}

export default SideNav
