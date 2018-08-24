import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { isEqual } from 'lodash'
import FontAwesome from 'react-fontawesome'
import classnames from 'classnames'

class SideNav extends Component {
  constructor(props) {
    super(props)

    this._handleSignOut = this._handleSignOut.bind(this)
  }
  componentWillUpdate(nextProps, nextState) {
    return !isEqual(this.props, nextProps)
  }

  _handleSignOut() {
    this.props.closeMenu()
    this.props.signOut()
  }

  render() {
    let className = classnames('sidenav', {
      closed: !this.props.menuOpen
    })

    return (
      <div className={className}>
        <span
          className="closebtn cursor add-top"
          onClick={this.props.closeMenu}
        >
          <FontAwesome className="lightpurple-text" name="times" />
        </span>
        <Link to="/" onClick={this.props.closeMenu}>
          <FontAwesome className="lightpurple-text" name="signal" />
          &nbsp;&nbsp;Activity
        </Link>
        <Link to="/about" onClick={this.props.closeMenu}>
          <FontAwesome className="lightpurple-text" name="list" />
          &nbsp;&nbsp;About
        </Link>
        {this.props.app &&
          this.props.app.auth &&
          this.props.app.auth.access_token && (
          <Link to="/login" onClick={this._handleSignOut}>
            <FontAwesome className="lightpurple-text" name="sign-out" />
              &nbsp;&nbsp;Logout
          </Link>
        )}
      </div>
    )
  }
}

SideNav.defaultProps = {
  app: {}
}

SideNav.propTypes = {
  menuOpen: PropTypes.bool.isRequired,
  closeMenu: PropTypes.func.isRequired,
  signOut: PropTypes.func.isRequired,
  app: PropTypes.object
}

export default SideNav
