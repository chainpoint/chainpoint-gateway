import { connect } from 'react-redux'
import Login from './components/Login'
import { submitLogin } from '../../reducers/appReducer'

const mapStateToProps = (state, ownProps) => {
  return {
    nodeConfig: state.app.node,
    node: state.node,
    auth: state.node.auth,
    routing: state.routing
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    submitLogin: (accessToken) => dispatch(submitLogin(accessToken))
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Login)
