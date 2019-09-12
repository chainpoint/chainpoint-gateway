#!/bin/sh
cd $(dirname $0)

NETWORK=$(cat ../.env | grep NETWORK= | cut -d '=' -f2)
LND_TLS_CERT=$(cat ../.env | grep LND_TLS_CERT= | cut -d '=' -f2)
LND_MACAROON=$(cat ../.env | grep LND_MACAROON= | cut -d '=' -f2)
LND_SOCKET=$(cat ../.env | grep LND_TLS_CERT= | cut -d '=' -f2)

HOT_WALLET_PASSWORD=$(cat ../.env | grep HOT_WALLET_PASSWORD= | cut -d '=' -f2)
HOT_WALLET_SEED=$(cat ../.env | grep HOT_WALLET_SEED= | cut -d '=' -f2)


export NETWORK=$NETWORK
export LND_TLS_CERT=$LND_TLS_CERT
export LND_MACAROON=$LND_MACAROON
export LND_SOCKET=$LND_SOCKET

export HOT_WALLET_PASSWORD=$HOT_WALLET_PASSWORD
export HOT_WALLET_SEED=$HOT_WALLET_SEED