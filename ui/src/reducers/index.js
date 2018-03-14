import { combineReducers } from 'redux'
import { routerReducer } from 'react-router-redux'
import appReducer from './appReducer'
import nodeReducer from './nodeReducer'

export default combineReducers({
  app: appReducer,
  node: nodeReducer,
  routing: routerReducer
})
