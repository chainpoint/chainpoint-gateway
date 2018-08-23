import React, { Component } from 'react'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { BrowserRouter, Route, Switch } from 'react-router-dom'
import { store, persistor, history } from './store'
import { syncHistoryWithStore } from 'react-router-redux'
import TopNav from './components/Nav'
import PrivateRoute from './components/PrivateRoute'
import Dashboard from './routes/Dashboard'
import NodeStatus from './routes/NodeStatus'
import Login from './routes/Login'
import 'url-polyfill'

import './css/index.css'
import './css/colors.css'
import './css/utils.css'
import './css/tiles.css'
import './css/sidemenu.css'
import './css/about.css'
import 'react-table/react-table.css'

const syncedHistory = syncHistoryWithStore(history, store)

class App extends Component {
  render() {
    return (
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <BrowserRouter history={syncedHistory}>
            <section className="app">
              <TopNav />
              <Switch>
                <PrivateRoute
                  exact
                  path="/"
                  component={props => <Dashboard {...props} />}
                />
                <PrivateRoute
                  exact
                  path="/about"
                  component={props => <NodeStatus {...props} />}
                />
                <Route
                  exact
                  path="/login"
                  component={props => <Login {...props} />}
                />
              </Switch>
            </section>
          </BrowserRouter>
        </PersistGate>
      </Provider>
    )
  }
}

export default App
