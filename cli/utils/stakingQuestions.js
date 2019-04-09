const Web3 = require('web3')

const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8546', null, {})

module.exports = {
  NODE_ETH_REWARDS_ADDRESS: {
    type: 'input',
    name: 'NODE_ETH_REWARDS_ADDRESS',
    message: 'Enter a valid Ethereum Rewards Address',
    validate: input => web3.utils.isAddress(input)
  },
  AUTO_ACQUIRE_ENABLED: {
    type: 'list',
    name: 'AUTO_ACQUIRE_ENABLED',
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
    default: true
  },
  AUTO_ACQUIRE_AMOUNT: {
    type: 'number',
    name: 'AUTO_ACQUIRE_AMOUNT',
    message: 'The number of credits to purchase on each acquistition, from 1 to 8760',
    default: 720,
    validate: (val, answers) => {
      if (answers['AUTO_ACQUIRE_ENABLED'] == true) {
        return val >= 1 && val <= 8760
      } else {
        return val >= 0 && val <= 8760
      }
    }
  }
}
