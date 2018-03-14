import React, { Component } from 'react'
import PropTypes from 'prop-types'
import { Grid, Row, Col } from 'react-bootstrap'
import { isUndefined as _isUndefined, isNumber as _isNumber, toNumber as _toNumber } from 'lodash'
import moment from 'moment'
import CountTile from '../../../components/CountTile'
import ReactTable from 'react-table'

const columns = [
  {
    Header: () => <span className='left align'>Hash ID</span>,
    getHeaderProps: (state, rowInfo, column) => {
      return {
        style: {
          'textAlign': 'left',
          'color': 'white',
          'padding': '15px',
          'border': 'none',
          'borderTopLeftRadius': '8px',
          'backgroundColor': '#B2BEC4'
        }
      }
    },
    accessor: 'hash_id_node'
  },
  {
    Header: 'Received',
    accessor: 'created_at',
    maxWidth: 240,
    getHeaderProps: (state, rowInfo, column) => {
      return {
        style: {
          'textAlign': 'right',
          'color': 'white',
          'padding': '15px',
          'border': 'none',
          'borderTopRightRadius': '8px',
          'backgroundColor': '#B2BEC4'
        }
      }
    },
    getProps: (state, rowInfo, column) => {
      return {
        style: {
          'textAlign': 'right'
        }
      }
    },
    Cell: props => <span className='number right-align'>{moment(props.value).format('YYYY-MM-DD HH:MM:SS')}</span>
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
    }, 5000)
  }

  _mapHashesReceivedToday (hashes = []) {
    return hashes.map(currVal => ({ hash_id_node: currVal.split('|')[0], created_at: currVal.split('|')[1] }))
  }

  componentWillUnmount () {
    clearInterval(this.statsInterval)
  }

  render () {
    return (
      <section>
        <div className='dashboard-view-wrapper hero-wrapper'>
          <Grid>
            <Row className='add-bottom-padding'>
              <Col xs={2}>
                <h3 className='lightgray-text add-bottom'>Activity</h3>
              </Col>
              <Col xs={10}>
                <CountTile count={this.props.node.stats.last_1_days ? this.props.node.stats.last_1_days.hour : null} size={4} title='Hashes Received' subTitle='Current Hour' color='tierion-tile-gradient' opacity='0.85' txtcolor='tierion-skyblue-text' />
                <CountTile count={this.props.node.stats.last_1_days ? this.props.node.stats.last_1_days.last24Hrs : null} size={4} title='Hashes Received' subTitle='Past 24 Hours' color='tierion-tile-gradient' opacity='0.85' txtcolor='tierion-skyblue-text' />
                <CountTile count={(this.props.nodeConfig && this.props.nodeConfig.calendar) ? this.props.nodeConfig.calendar.height : null} size={4} title='Calendar Height' subTitle='Current' color='tierion-tile-gradient' opacity='0.85' txtcolor='tierion-skyblue-text' extraClasses='no-padding-right' />
              </Col>
            </Row>
          </Grid>
        </div>
        <div>
          <Grid>
            <Row className='add-top add-bottom'>
              <Col xs={12} className='add-top add-bottom'>
                <ReactTable data={this.props.node.stats.last_1_days ? this._mapHashesReceivedToday(this.props.node.stats.last_1_days.hashesReceivedToday) : []} columns={columns} defaultPageSize={25} showPagination={false} showPaginationBottom />
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
