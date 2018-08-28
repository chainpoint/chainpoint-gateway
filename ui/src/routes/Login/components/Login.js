import React, { Component } from 'react'
import PropTypes from 'prop-types'
import {
  Grid,
  Row,
  Col,
  Well,
  FormGroup,
  ControlLabel,
  FormControl,
  HelpBlock,
  ButtonGroup,
  Button
} from 'react-bootstrap'

class Login extends Component {
  constructor(props) {
    super(props)

    this.state = { value: '', edited: false, persistenceEnabled: true }
    this._handleChange = this._handleChange.bind(this)
    this._handleLogin = this._handleLogin.bind(this)
  }

  componentDidMount() {
    this.props
      .submitLogin(this.state.value)
      .then(() => {
        return this.props.getNodeStats('last_1_days').then(
          () => {
            return this.props.history.push('/')
          },
          () => {}
        )
      })
      .catch(() => {})

    try {
      const storage = window['localStorage']
      const x = '__storage_test__'
      storage.setItem(x, x)
      storage.removeItem(x)
    } catch (e) {
      this.setState({ persistenceEnabled: false })
    }
  }

  getValidationState() {
    const length = this.state.value.length
    if (length > 0) return 'success'

    return null
  }

  _handleChange(e) {
    this.setState({ value: e.target.value, submitted: false })
  }

  _handleLogin(e) {
    e.preventDefault()
    this.setState({ submitted: true })

    this.props.submitLogin(this.state.value).then(
      () => {
        this.props.history.push('/')
      },
      () => {}
    )
  }

  render() {
    return (
      <section>
        <Grid fluid>
          {!this.state.persistenceEnabled ? (
            <Row className="add-top">
              <Col xs={8} xsOffset={2}>
                We&apos;ve detected that you have cookies disabled. This
                application requires the use of browser local storage. Enabling
                cookies for your Node&apos;s address will allow persisting your
                login.
              </Col>
            </Row>
          ) : (
            ''
          )}
          <Row className="add-top">
            <Col xs={8} xsOffset={2}>
              <Well>
                <form onSubmit={this._handleLogin}>
                  <FormGroup controlId="accessToken">
                    <ControlLabel>Password:</ControlLabel>
                    <FormControl
                      type="password"
                      value={this.state.value}
                      placeholder="Enter Password..."
                      onChange={this._handleChange}
                    />
                    <FormControl.Feedback />

                    {this.props.app.status &&
                      this.props.app.status.error &&
                      this.props.app.status.event === 'AUTH_LOGIN_ERROR' &&
                      this.state.submitted && (
                        <HelpBlock>
                          <span className="firebrick-text">
                            Invalid Login. Please try again.
                          </span>
                        </HelpBlock>
                      )}

                    <div className="add-top">
                      <ButtonGroup vertical block>
                        <Button
                          bsStyle="primary"
                          type="submit"
                          onClick={this._handleLogin}
                          onSubmit={this._handleLogin}
                        >
                          Login
                        </Button>
                      </ButtonGroup>
                    </div>
                  </FormGroup>
                </form>
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
  submitLogin: PropTypes.func.isRequired,
  getNodeStats: PropTypes.func,
  history: PropTypes.shape({
    push: PropTypes.func.isRequired
  }),
  app: PropTypes.object.shape({
    status: PropTypes.object.shape({
      error: PropTypes.bool,
      event: PropTypes.string
    })
  })
}

export default Login
