import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid, Row, Col } from 'react-bootstrap'
import { isUndefined as _isUndefined, isNumber as _isNumber, toNumber as _toNumber } from 'lodash'
import CountTile from '../../../components/CountTile'
import ReactTable from 'react-table'

const columns = [
  {
    Header: () => <span className='left align'>HASH ID</span>,
    getHeaderProps: (state, rowInfo, column) => {
      return {
        style: {
          'textAlign': 'left',
          'color': 'white',
          'fontSize': '16px',
          'fontWeight': 'bold',
          'padding': '25px',
          'border': 'none',
          'borderTopLeftRadius': '8px',
          'backgroundColor': '#B2BEC4'
        }
      }
    },
    getProps: (state, rowInfo, column) => {
      return {
        style: {
          'color': '#90a4ae'
        }
      }
    },
    accessor: 'hash_id_node'
  },
  {
    Header: 'RECEIVED',
    accessor: 'created_at',
    maxWidth: 240,
    getHeaderProps: (state, rowInfo, column) => {
      return {
        style: {
          'textAlign': 'right',
          'color': 'white',
          'fontSize': '16px',
          'fontWeight': 'bold',
          'padding': '25px',
          'border': 'none',
          'borderTopRightRadius': '8px',
          'backgroundColor': '#B2BEC4'
        }
      }
    },
    getProps: (state, rowInfo, column) => {
      return {
        style: {
          'textAlign': 'right',
          'color': '#90a4ae'
        }
      }
    },
    Cell: props => {
      return (
        <span className='right-align'>{props.value}</span>
      )
    }
  }
]

class Dashboard extends Component {
  constructor (props, context) {
    super(props)

    this._mapHashesReceivedToday = this._mapHashesReceivedToday.bind(this)
  }

  componentWillMount () {
    if (_isUndefined(this.props.auth.access_token)) {
      this.props.history.push('/login')
    }
  }

  componentDidMount () {
    // Fetch Node Config Details like version, calendar block height, etc.
    this.props.getNodeConfig()
    // Fetch Node stats 'last_1_days' filter by default
    this.props.getNodeStats('last_1_days').catch(err => {
      if (_isNumber(_toNumber(err)) && parseInt(err, 10) === 401) this.props.history.push('/login')
    })

    this.statsInterval = setInterval(() => {
      // Provide near real-time information
      this.props.getNodeConfig()
      this.props.getNodeStats('last_1_days')
    }, 1000)
  }

  _mapHashesReceivedToday (hashes = []) {
    return hashes.map(currVal => ({ hash_id_node: currVal.split('|')[0], hash: currVal.split('|')[1], created_at: currVal.split('|')[2] }))
  }

  componentWillUnmount () {
    clearInterval(this.statsInterval)
  }

  render () {
    return (
      <section>
        <div className='dashboard-view-wrapper hero-wrapper'>
          <Grid fluid>
            <Row className='add-bottom-padding'>
              <Col xs={12}>
                <Col xs={12} sm={2} className='add-top add-bottom'>
                  <h3 className='title lightgray-text add-bottom'>ACTIVITY</h3>
                </Col>
                <Col xs={12} sm={10} className='add-top add-bottom'>
                  <CountTile count={this.props.node.stats.last_1_days ? this.props.node.stats.last_1_days.hour : null} size={4} title='Hashes Received' subTitle='Current Hour' color='tierion-tile-gradient' opacity='0.85' txtcolor='tierion-skyblue-text' />
                  <CountTile count={this.props.node.stats.last_1_days ? this.props.node.stats.last_1_days.last24Hrs : null} size={4} title='Hashes Received' subTitle='Past 24 Hours' color='tierion-tile-gradient' opacity='0.85' txtcolor='tierion-skyblue-text' />
                  <CountTile count={(this.props.nodeConfig && this.props.nodeConfig.calendar) ? this.props.nodeConfig.calendar.height : null} size={4} title='Calendar Height' subTitle='Current' color='tierion-tile-gradient' opacity='0.85' txtcolor='tierion-skyblue-text' extraClasses='last-tile no-padding-right' />
                </Col>
              </Col>
            </Row>
          </Grid>
        </div>
        <div>
          <Grid fluid>
            <Row className='add-top add-bottom'>
              <Col xs={12} className='add-top add-bottom'>
                <Col xs={12}>
                  <ReactTable
                    getTrProps={(state, rowInfo, column) => {
                      return {
                        style: {
                          'background': '#FFFFFF',
                          'paddingLeft': '18px',
                          'paddingRight': '18px',
                          'paddingTop': '10px',
                          'paddingBottom': '10px',
                          'fontSize': '16px',
                          'fontWeight': '300'
                        }
                      }
                    }}
                    sortable={false}
                    data={this.props.node.stats.last_1_days ? this._mapHashesReceivedToday(this.props.node.stats.last_1_days.hashesReceivedToday) : []}
                    columns={columns}
                    defaultPageSize={25}
                    showPagination={false} />
                </Col>
              </Col>
            </Row>
          </Grid>
        </div>
      </section>

    )
  }
}

Dashboard.propTypes = {
  getNodeStats: PropTypes.func.isRequired
}

Dashboard.defaultProps = {
  nodeConfig: {},
  auth: {}
}

export default Dashboard
