import { GET_NODE_CONFIG_SUCCESSFUL, GET_NODE_CONFIG_ERROR } from './nodeReducer'

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [GET_NODE_CONFIG_SUCCESSFUL]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: GET_NODE_CONFIG_SUCCESSFUL,
        fetching: false,
        processing: false,
        successful: true,
        error: false,
        errormsg: null
      },
      node: action.payload
    })
  },
  [GET_NODE_CONFIG_ERROR]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: GET_NODE_CONFIG_ERROR,
        fetching: false,
        processing: false,
        successful: false,
        error: true,
        errormsg: action.payload
      }
    })
  }
}

// ------------------------------------
// Reducer
// ------------------------------------
const initialState = {}
export default function appReducer (state = initialState, action) {
  const handler = ACTION_HANDLERS[action.type]

  return handler ? handler(state, action) : state
}
