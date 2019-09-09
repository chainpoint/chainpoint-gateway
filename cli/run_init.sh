#!/bin/bash
cd $(dirname $0)
source scripts/env_secrets_expand.sh
yarn
node cli/swarm_secrets_init.js NODE_PUBLIC_IP_ADDRESS=${NODE_PUBLIC_IP_ADDRESS} NETWORK=${NETWORK}
