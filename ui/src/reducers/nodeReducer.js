import deepAssign from 'deep-assign'
// ------------------------------------
// Constants
// ------------------------------------
export const GET_NODE_STATS = 'GET_NODE_STATS'
export const GET_NODE_STATS_SUCCESSFUL = 'GET_NODE_STATS_SUCCESSFUL'
export const GET_NODE_STATS_ERROR = 'GET_NODE_STATS_ERROR'
export const GET_NODE_CONFIG = 'GET_NODE_CONFIG'
export const GET_NODE_CONFIG_SUCCESSFUL = 'GET_NODE_CONFIG_SUCCESSFUL'
export const GET_NODE_CONFIG_ERROR = 'GET_NODE_CONFIG_ERROR'
export const GET_NODE_HASHES_RECEIVED_TODAY_LIST = 'GET_NODE_HASHES_RECEIVED_TODAY_LIST'
export const GET_NODE_HASHES_RECEIVED_TODAY_LIST_SUCCESSFUL = 'GET_NODE_HASHES_RECEIVED_TODAY_LIST_SUCCESSFUL'
export const GET_NODE_HASHES_RECEIVED_TODAY_LIST_ERROR = 'GET_NODE_HASHES_RECEIVED_TODAY_LIST_ERROR'

// ------------------------------------
// Actions
// ------------------------------------
export function getNodeConfig (query) {
  return async (dispatch, getState) => {
    dispatch({ type: GET_NODE_CONFIG, payload: null })

    try {
      let result = await fetch('http://0.0.0.0:9090/config').then(res => res.json()) // eslint-disable-line
      dispatch({ type: GET_NODE_CONFIG_SUCCESSFUL, payload: Object.assign({}, result, { ip: '127.0.0.1' }) })

      return result
    } catch (error) {
      dispatch({ type: GET_NODE_CONFIG_ERROR, payload: error.message })

      return Promise.reject(error.message)
    }
  }
}

export function getNodeStats (query = 'last_1_days') {
  return async (dispatch, getState) => {
    const transformStatsResult = (res) => {
      if (query === 'last_1_days' || query === 'all') {
        return deepAssign({}, {
          [query]: {
            hashesReceived: 0,
            proofsRetrieved: 0,
            proofsVerified: 0
          }
        }, {
          [query]: res[query]
        })
      }

      return res
    }
    dispatch({ type: GET_NODE_STATS, payload: { query } })
    try {
      let url = new URL('http://0.0.0.0:9090/stats') // eslint-disable-line
      let params = Object.assign({}, {filter: query}, {
        ...(query === 'last_1_days') ? { verbose: true } : {}
      })
      Object.keys(params).forEach(key => url.searchParams.append(key, params[key]))

      let result = await fetch(url).then(res => res.json()) // eslint-disable-line
      dispatch({ type: GET_NODE_STATS_SUCCESSFUL, payload: { data: transformStatsResult(result) } })

      return result
    } catch (error) {
      dispatch({ type: GET_NODE_STATS_ERROR, payload: error.message })

      return Promise.reject(error.message)
    }
  }
}

// ------------------------------------
// Action Handlers
// ------------------------------------
const ACTION_HANDLERS = {
  [GET_NODE_STATS]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: GET_NODE_STATS,
        fetching: true,
        processing: false,
        successful: false,
        error: false,
        errormsg: null
      },
      stats: {
        ...state.stats
      }
    })
  },
  [GET_NODE_STATS_SUCCESSFUL]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: GET_NODE_STATS,
        fetching: false,
        processing: false,
        successful: true,
        error: false,
        errormsg: null
      },
      stats: {
        ...state.stats,
        ...action.payload.data
      }
    })
  },
  [GET_NODE_STATS_ERROR]: (state, action) => {
    return Object.assign({}, state, {
      status: {
        event: GET_NODE_STATS,
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
const initialState = {
  status: {
    event: null,
    fetching: false,
    processing: false,
    successful: false,
    error: false,
    errormsg: null
  },
  stats: {}
}
export default function nodeReducer (state = initialState, action) {
  const handler = ACTION_HANDLERS[action.type]

  return handler ? handler(state, action) : state
}
