#!/bin/bash
cd $(dirname $0)
source ./env_secrets_expand.sh
yarn start
