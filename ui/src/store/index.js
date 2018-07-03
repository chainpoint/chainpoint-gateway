import { createStore, applyMiddleware, compose } from 'redux'
import { routerMiddleware } from 'react-router-redux'
import thunk from 'redux-thunk'
import createHistory from 'history/createBrowserHistory'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import rootReducer from '../reducers'

export const history = createHistory()

const initialState = { app: {} }

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['app']
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

const enhancers = []
const middleware = [
  thunk,
  routerMiddleware(history)
]

if (process.env.NODE_ENV === 'development') {
  const devToolsExtension = window.devToolsExtension

  if (typeof devToolsExtension === 'function') {
    enhancers.push(devToolsExtension())
  }
}
// Manually remove 'redux' key from LocalStorage which was previously managed by redux-localstorage package
window.localStorage.removeItem('redux')

const composedEnhancers = compose(
  applyMiddleware(...middleware),
  ...enhancers
)

export const store = createStore(
  persistedReducer,
  initialState,
  composedEnhancers
)

export const persistor = persistStore(store)
