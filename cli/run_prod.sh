#!/bin/bash
cd $(dirname $0)
source scripts/prod_secrets_expand.sh
yarn start