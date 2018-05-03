import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { unregister } from './registerServiceWorker'

import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap/dist/css/bootstrap-theme.css'

ReactDOM.render(<App />, document.getElementById('root'))
unregister()
