import React, { Component } from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Grid, Row, Col } from 'react-bootstrap'
import { withRouter } from 'react-router-dom'
import moment from 'moment'
import FontAwesome from 'react-fontawesome'
import SideNav from '../SideNav'

class TopNav extends Component {
  constructor (props) {
    super(props)

    this._handleOpenMenu = this._handleOpenMenu.bind(this)
    this.state = { currTime: moment().format('MMMM Do YYYY, hh:mmA'), menuOpen: false }
  }

  componentDidMount () {
    setInterval(() => {
      this.setState({
        currTime: moment().format('MMMM Do YYYY, hh:mmA')
      })
    }, 3000)
  }

  _handleOpenMenu () {
    this.setState({
      menuOpen: !this.state.menuOpen
    })
  }

  render () {
    return (
      <section className='chainpoint-client-nav'>
        <div className='chp-navbar'>
          <Grid>
            <Row>
              <Col xs={3}>
                <img className='nav-logo add-top-padding' src={`${process.env.PUBLIC_URL}/images/chainpoint_logo@2x.png`} alt='Chainpoint' />
              </Col>
              <Col xs={9}>
                <div className='pull-right' style={{'paddingTop': '10px'}}>
                  <span className='pull-left add-right add-top-padding-less'><FontAwesome name='circle' className='greentea-text' /></span>
                  <span className='pull-right curosr' onClick={this._handleOpenMenu}><FontAwesome size='2x' name='bars' className='platinum-text' /></span>
                </div>
              </Col>
            </Row>
          </Grid>
        </div>
        <SideNav menuOpen={this.state.menuOpen} closeMenu={() => this._handleOpenMenu()} />
        <div className='clearfix' />
      </section>
    )
  }
}

TopNav.propTypes = {
  app: PropTypes.object.isRequired
}

const mapStateToProps = (state, ownProps) => {
  return {
    app: state.app,
    routing: state.routing
  }
}

export default connect(mapStateToProps)(withRouter(TopNav))
