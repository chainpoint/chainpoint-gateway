#!/bin/bash
cd $(dirname $0)
source scripts/env_secrets_expand.sh
yarn
# NODE_PUBLIC_IP_ADDRESS=${NODE_PUBLIC_IP_ADDRESS} NETWORK=${NETWORK}
node ./lnd_bootstrap.js 
