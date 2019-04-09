#!/bin/bash

echo -e "Generating ethereum wallet...\n"
WALLET=$(node scripts/createWallets.js)
ADDR=$(echo $WALLET | jq -r '.address')
PK=$(echo $WALLET | jq -r '.privateKey')

echo "THIS IS THE ONLY TIME YOU'LL BE ABLE TO SAVE YOUR NODE ETH WALLET"
echo -e "BEFORE IT BECOMES SECRET!\n"

echo -e "WALLET: $WALLET\n"

echo "Address Stored:"
echo $ADDR | docker secret create NODE_ETH_ADDRESS -
echo

echo "Private Key Stored:"
echo $PK | docker secret create NODE_ETH_PRIVATE_KEY -
echo

echo -e "PLEASE SEND 5000 TNT TO $ADDR IN ORDER TO STAKE, THEN RUN make stake"
