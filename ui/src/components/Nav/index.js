import React, { Component } from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { Grid, Row, Col } from 'react-bootstrap'
import { withRouter } from 'react-router-dom'
import moment from 'moment'
import SideNav from '../SideNav'
import { signOut } from '../../reducers/appReducer'

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
          <Grid fluid>
            <Row>
              <Col xs={12}>
                <Col xs={3}>
                  <img className='nav-logo add-top-padding' src={`${process.env.PUBLIC_URL}/images/chainpoint_logo@2x.png`} alt='Chainpoint' />&nbsp;&nbsp;&nbsp;&nbsp;<span style={{color: '#757575', position: 'relative', top: '22px'}}>PREVIEW RELEASE</span>
                </Col>
                <Col xs={9}>
                  <div className='pull-right' style={{'paddingTop': '40px'}}>
                    {/* <span className='pull-left add-right add-top-padding-less'><FontAwesome name='circle' className='greentea-text' /></span> */}
                    <img onClick={this._handleOpenMenu} className='pull-right cursor' width='30' height='20' src={`${process.env.PUBLIC_URL}/images/menu-icon@2x.png`} alt='Menu' />
                  </div>
                </Col>
              </Col>
            </Row>
          </Grid>
        </div>
        <SideNav app={this.props.app} signOut={this.props.signOut} menuOpen={this.state.menuOpen} closeMenu={() => this._handleOpenMenu()} />
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

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    signOut: () => {
      dispatch(signOut())
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(TopNav))
