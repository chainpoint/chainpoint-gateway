import React from 'react'
import { Route, Redirect, withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import { isUndefined as _isUndefined } from 'lodash'

const PrivateRoute = ({ component: Component, ...rest }) => {
  const {auth} = rest.app
  console.log(auth)
  return (
    <Route {...rest}
      render={props => !_isUndefined(auth) && !_isUndefined(auth.access_token)
        ? <Component {...props} />
        : <Redirect to='/login' />
      }
    />
  )
}

const mapStateToProps = (state, ownProps) => {
  return { app: state.app }
}

export default connect(mapStateToProps)(withRouter(PrivateRoute))
