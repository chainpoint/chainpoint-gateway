import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid, Row, Col, Well, FormGroup, ControlLabel, FormControl, HelpBlock, ButtonGroup, Button } from 'react-bootstrap'

class Login extends Component {
  constructor (props) {
    super(props)

    this.state = { value: '' }
    this.handleChange = this.handleChange.bind(this)
    this._handleLogin = this._handleLogin.bind(this)
  }

  getValidationState () {
    const length = this.state.value.length
    if (length > 0) return 'success'

    return null
  }

  handleChange (e) {
    this.setState({ value: e.target.value })
  }

  _handleLogin () {
    this.props.submitLogin(this.state.value).then(() => {
      this.props.history.push('/')
    })
  }

  render () {
    return (
      <section>
        <Grid>
          <Row className='add-top'>
            <Col xs={8} xsOffset={2}>
              <Well>
                <FormGroup controlId='accessToken'>
                  <ControlLabel>Password:</ControlLabel>
                  <FormControl
                    type='password'
                    value={this.state.value}
                    placeholder='Enter Password...'
                    onChange={this.handleChange} />
                  <FormControl.Feedback />

                  {(this.props.node.status.error && this.props.node.status.event === 'AUTH_LOGIN_ERROR') && (<HelpBlock><span className='firebrick-text'>Invalid Login. Please try again.</span></HelpBlock>)}

                  <div className='add-top'>
                    <ButtonGroup vertical block>
                      <Button bsStyle='primary' onClick={this._handleLogin}>Login</Button>
                    </ButtonGroup>
                  </div>
                </FormGroup>
              </Well>
            </Col>
          </Row>
        </Grid>
      </section>
    )
  }
}

Login.propTypes = {
  node: PropTypes.object.isRequired,
  submitLogin: PropTypes.func.isRequired
}

export default Login
