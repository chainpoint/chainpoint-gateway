// const { isEmpty } = require('lodash')

module.exports = {
  NETWORK: {
    type: 'list',
    name: 'NETWORK',
    message: 'Enable automatic acquisition of credit when balance reaches 0?',
    choices: [
      {
        name: 'Mainnet',
        value: 'mainnet'
      },
      {
        name: 'Testnet',
        value: 'testnet'
      }
    ]
  },
  CORE_PAYMENT_CHANNEL_COUNT: {
    type: 'number',
    name: 'CORE_PAYMENT_CHANNEL_COUNT',
    message: 'Enter # of Chainpoint Cores you wish to initiate payment channels with',
    validate: val => {
      return val > 0
    }
  },
  CONNECTED_CORE_PAYMENT_CHANNELS_IPS: {
    type: 'input',
    name: 'CONNECTED_CORE_PAYMENT_CHANNELS_IPS',
    message:
      'Specify a comma-delimited list of IPv4 Addresses associated with the Chainpoint Core(s) you wish to create LND Payment Channels with (optional: will select random Cores if not provided)',
    default: 'random',
    validate: (val, answers) => {
      if (val === 'random') {
        return true
      } else if (val !== 'random' && val.split(',').length === parseInt(answers['CORE_PAYMENT_CHANNEL_COUNT'], 10)) {
        return val.split(',').reduce((isValid, currVal) => {
          if (!isValid) return false

          return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{1,5}$/.test(currVal)
        }, true)
      } else {
        return false
      }
    }
  },
  SATOSHIS_PER_CORE_PAYMENT_CHANNEL: {
    type: 'number',
    name: 'SATOSHIS_PER_CORE_PAYMENT_CHANNEL',
    message: 'Enter # of satoshis you wish to commit to each payment channel',
    validate: val => {
      return val >= 100000
    }
  }
}
