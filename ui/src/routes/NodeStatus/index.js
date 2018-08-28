import { connect } from 'react-redux'
import NodeStatus from './components/NodeStatus'
import { getNodeConfig, getNodeStats } from '../../reducers/nodeReducer'

const mapStateToProps = state => {
  return {
    nodeConfig: state.node.config,
    nodeData: state.node.nodeData,
    node: state.node,
    auth: state.app.auth,
    routing: state.routing
  }
}

const mapDispatchToProps = dispatch => {
  return {
    getNodeConfig: () => dispatch(getNodeConfig()),
    getNodeStats: () => dispatch(getNodeStats())
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(NodeStatus)
