import { connect } from 'react-redux'
import Login from './components/Login'
import { submitLogin } from '../../reducers/appReducer'
import { getNodeStats } from '../../reducers/nodeReducer'

const mapStateToProps = (state, ownProps) => {
  return {
    app: state.app,
    nodeConfig: state.node.config,
    node: state.node,
    auth: state.node.auth,
    routing: state.routing
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    submitLogin: (accessToken) => dispatch(submitLogin(accessToken)),
    getNodeStats: (query) => dispatch(getNodeStats(query))
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Login)
