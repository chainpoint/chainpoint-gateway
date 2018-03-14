import { GET_NODE_CONFIG_SUCCESSFUL, GET_NODE_CONFIG_ERROR } from './nodeReducer'

export const AUTH_LOGIN = 'AUTH_LOGIN'
export const AUTH_LOGIN_SUCCESSFUL = 'AUTH_LOGIN_SUCCESSFUL'
export const AUTH_LOGIN_ERROR = 'AUTH_LOGIN_ERROR'
export const AUTH_REQUIRED_ERROR = 'AUTH_REQUIRED_ERROR'

export function submitLogin (accessToken) {
  return async (dispatch, getState) => {
    try {
      dispatch({ type: AUTH_LOGIN, payload: null })

      dispatch({ type: AUTH_LOGIN_SUCCESSFUL, payload: accessToken })

      return Promise.resolve(accessToken)
    } catch (error) {
      dispatch({ type: AUTH_LOGIN_ERROR, payload: error.message })

      return Promise.reject(error.message)
    }
  }
}

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
  },
  [AUTH_LOGIN]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: AUTH_LOGIN,
        fetching: false,
        processing: true,
        successful: false,
        error: false,
        errormsg: null
      }
    })
  },
  [AUTH_LOGIN_SUCCESSFUL]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: AUTH_LOGIN_SUCCESSFUL,
        fetching: false,
        processing: false,
        successful: true,
        error: false,
        errormsg: null
      },
      auth: {
        access_token: action.payload
      }
    })
  },
  [AUTH_LOGIN_ERROR]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: AUTH_LOGIN_ERROR,
        fetching: false,
        processing: false,
        successful: false,
        error: true,
        errormsg: action.payload
      },
      auth: {}
    })
  },
  [AUTH_REQUIRED_ERROR]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: AUTH_REQUIRED_ERROR,
        fetching: false,
        processing: false,
        successful: false,
        error: true,
        errormsg: action.payload
      },
      auth: {}
    })
  }
}

// ------------------------------------
// Reducer
// ------------------------------------
const initialState = {
  status: {
    event: GET_NODE_CONFIG_ERROR,
    fetching: false,
    processing: false,
    successful: false,
    error: false,
    errormsg: null
  },
  auth: {}
}
export default function appReducer (state = initialState, action) {
  const handler = ACTION_HANDLERS[action.type]

  return handler ? handler(state, action) : state
}
