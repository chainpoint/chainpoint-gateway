import { connect } from 'react-redux'
import Dashboard from './components/Dashboard'
import { getNodeConfig, getNodeStats } from '../../reducers/nodeReducer'

const mapStateToProps = (state, ownProps) => {
  return {
    nodeConfig: state.app.node,
    node: state.node,
    auth: state.app.auth,
    routing: state.routing
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    getNodeStats: (query) => dispatch(getNodeStats(query)),
    getNodeConfig: () => dispatch(getNodeConfig())
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard)
