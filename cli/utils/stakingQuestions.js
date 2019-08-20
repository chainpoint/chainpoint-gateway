const validator = require('validator')
const { isEmpty } = require('lodash')

module.exports = {
  NODE_ETH_REWARDS_ADDRESS: {
    type: 'input',
    name: 'NODE_ETH_REWARDS_ADDRESS',
    message: 'Enter a valid Ethereum Rewards Address',
    validate: input => /^0x[a-fA-F0-9]{40}$/.test(input)
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
  }
}
