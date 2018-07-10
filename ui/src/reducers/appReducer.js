import { toLower as _toLower, startsWith as _startsWith } from 'lodash'

export const AUTH_LOGIN = 'AUTH_LOGIN'
export const AUTH_LOGIN_SUCCESSFUL = 'AUTH_LOGIN_SUCCESSFUL'
export const AUTH_LOGIN_ERROR = 'AUTH_LOGIN_ERROR'
export const AUTH_REQUIRED_ERROR = 'AUTH_REQUIRED_ERROR'
export const AUTH_SIGN_OUT = 'AUTH_SIGN_OUT'

const getApiUrl = () => {
  return (process.env.NODE_ENV === 'development') ? 'http://localhost:9090' : window.location.origin
}

export function submitLogin (accessToken = '') {
  return async (dispatch, getState) => {
    try {
      const accessTokenLowered = (_startsWith(accessToken, '0x')) ? _toLower(accessToken) : accessToken
      dispatch({ type: AUTH_LOGIN, payload: null })

      dispatch({ type: AUTH_LOGIN_SUCCESSFUL, payload: accessTokenLowered })

      let headers = { auth: accessTokenLowered || '' }
      let url = new URL(`${getApiUrl()}/stats`) // eslint-disable-line
      let params = Object.assign({}, {filter: 'last_1_days'}, { verbose: true })
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]))
      let result = await fetch(url, { headers }).then(res => { // eslint-disable-line
        if (res.status === 401) throw new Error(401)

        return res.json()
      })

      return Promise.resolve(accessTokenLowered)
    } catch (error) {
      dispatch({ type: AUTH_LOGIN_ERROR, payload: error.message })

      return Promise.reject(error.message)
    }
  }
}

export function signOut () {
  return async (dispatch, getState) => {
    dispatch({ type: AUTH_SIGN_OUT, payload: null })

    return Promise.resolve()
  }
}

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
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
  [AUTH_SIGN_OUT]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: AUTH_SIGN_OUT,
        fetching: false,
        processing: false,
        successful: true,
        error: false,
        errormsg: null
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
    event: null,
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
