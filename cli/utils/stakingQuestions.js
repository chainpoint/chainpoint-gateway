const Web3 = require('web3')
const validator = require('validator')
const { isEmpty } = require('lodash')

const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8546', null, {})

module.exports = {
  NODE_ETH_REWARDS_ADDRESS: {
    type: 'input',
    name: 'NODE_ETH_REWARDS_ADDRESS',
    message: 'Enter a valid Ethereum Rewards Address',
    validate: input => web3.utils.isAddress(input)
  },
  NODE_PUBLIC_IP_ADDRESS: {
    type: 'input',
    name: 'NODE_PUBLIC_IP_ADDRESS',
    message: "Enter your Node's Public IP Address (optional: leave blank if private Node)",
    validate: input => {
      if (input) {
        return validator.isIP(input, 4)
      } else {
        return true
      }
    },
    externalValidate: input => !isEmpty(input) && validator.isIP(input, 4)
  },
  AUTO_REFILL_ENABLED: {
    type: 'list',
    name: 'AUTO_REFILL_ENABLED',
    message: 'Enable automatic acquisition of credit when balance reaches 0?',
    choices: [
      {
        name: 'Enable',
        value: true
      },
      {
        name: 'Disable',
        value: false
      }
    ],
    validate: input => {
      if (isEmpty(input)) return false

      if (input === true || input === 'true') return true
      else return false
    },
    default: true
  },
  AUTO_REFILL_AMOUNT: {
    type: 'number',
    name: 'AUTO_REFILL_AMOUNT',
    message: 'Enter Auto Refill Amount - specify in number of Credits (optional: specify if auto refill is enabled)',
    default: 720,
    validate: (val, answers) => {
      if (answers['AUTO_REFILL_ENABLED'] == true || answers['AUTO_REFILL_ENABLED'] == 'true') {
        return val >= 1 && val <= 8760
      } else {
        return val >= 0 && val <= 8760
      }
    }
  }
}
