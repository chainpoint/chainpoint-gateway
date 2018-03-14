import { connect } from 'react-redux'
import NodeStatus from './components/NodeStatus'
import { getNodeConfig } from '../../reducers/nodeReducer'

const mapStateToProps = (state, ownProps) => {
  return {
    nodeConfig: state.app.node,
    node: state.node,
    routing: state.routing
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    getNodeConfig: () => dispatch(getNodeConfig())
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(NodeStatus)
