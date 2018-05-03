import { connect } from 'react-redux'
import NodeStatus from './components/NodeStatus'
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
    getNodeConfig: () => dispatch(getNodeConfig()),
    getNodeStats: () => dispatch(getNodeStats())
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(NodeStatus)
