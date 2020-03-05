# Chainpoint Gateway

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

See [Chainpoint Start](https://github.com/chainpoint/chainpoint-start) for an overview of the Chainpoint Network.

A Chainpoint Gateway is a dedicated server for generating many Chainpoint proofs with a single request to the Chainpoint Network.

Each Gateway has an integrated Lightning Node running [LND](https://github.com/lightningnetwork/lnd). Gateways use [Lightning Service Authentication Tokens](https://www.npmjs.com/package/lsat-js) (LSATs) to pay Cores an `anchor fee` when submitting a Merkle root. The default anchor fee is 2 [satoshis](<https://en.bitcoin.it/wiki/Satoshi_(unit)>). Core operators can set their `anchor fee` to adapt to changing market conditions, and compete to receive transactions from Gateways

Gateway setup takes 45 - 90 mins, due to activities that require the automated setup tools to interact with the Bitcoin Blockchain.

- Lightning Node sync (10 - 15 minutes)
- Funding the Lightning wallet and waiting for 3 confirmations (avg 30 mins)

## Installation

### Requirements

The following software is required:

- `*Nix-based OS (Ubuntu Linux and MacOS have been tested)`
- `BASH`
- `Git`
- `Docker`

A BASH script to install all other dependencies (make, openssl, nodejs, yarn) on Ubuntu and Mac can be run from `make install-deps`.

Chainpoint Gateway has been tested with different hardware configurations.

Minimum:

- `4GB RAM`
- `1 CPU Cores`
- `128+ GB SSD`
- `Public IPv4 address`

Mid-Range:

- `8GB RAM`
- `2 CPU Cores`
- `256+ GB SSD`
- `Public IPv4 address`

### Deployment

Run the following commands to initiate your Gateway:

#### Install Dependencies

```bash
$ sudo apt-get install make git
$ git clone https://github.com/chainpoint/chainpoint-gateway.git
$ cd chainpoint-gateway
$ make install-deps

Logout and login to allow your user to use Docker

$ exit
```

#### Configure Gateway

```
$ ssh user@<your_ip>
$ cd chainpoint-gateway
$ make init


 ██████╗██╗  ██╗ █████╗ ██╗███╗   ██╗██████╗  ██████╗ ██╗███╗   ██╗████████╗     ██████╗  █████╗ ████████╗███████╗██╗    ██╗ █████╗ ██╗   ██╗
██╔════╝██║  ██║██╔══██╗██║████╗  ██║██╔══██╗██╔═══██╗██║████╗  ██║╚══██╔══╝    ██╔════╝ ██╔══██╗╚══██╔══╝██╔════╝██║    ██║██╔══██╗╚██╗ ██╔╝
██║     ███████║███████║██║██╔██╗ ██║██████╔╝██║   ██║██║██╔██╗ ██║   ██║       ██║  ███╗███████║   ██║   █████╗  ██║ █╗ ██║███████║ ╚████╔╝
██║     ██╔══██║██╔══██║██║██║╚██╗██║██╔═══╝ ██║   ██║██║██║╚██╗██║   ██║       ██║   ██║██╔══██║   ██║   ██╔══╝  ██║███╗██║██╔══██║  ╚██╔╝
╚██████╗██║  ██║██║  ██║██║██║ ╚████║██║     ╚██████╔╝██║██║ ╚████║   ██║       ╚██████╔╝██║  ██║   ██║   ███████╗╚███╔███╔╝██║  ██║   ██║
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝      ╚═════╝ ╚═╝╚═╝  ╚═══╝   ╚═╝        ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝


? Will this Gateway use Bitcoin mainnet or testnet? testnet
? Enter your Gateways's Public IP Address: 104.154.83.163
```

#### Initialize Lightning

```
Initializing Lightning wallet...
Create new address for wallet...
Creating Docker secrets...
****************************************************
Lightning initialization has completed successfully.
****************************************************
Lightning Wallet Password: kPlIshurrduurSQoXa
LND Wallet Seed: absorb behind drop safe like herp derp celery galaxy wait orient sign suit castle awake gadget pass pipe sudden ethics hill choose six orphan
Lightning Wallet Address:tb1qglvlrlg0velrserjuuy7s4uhrsrhuzwgl8hvgm
******************************************************
You should back up this information in a secure place.
******************************************************

TODO: REMOVE Please fund the Lightning Wallet Address above with Bitcoin and wait for 6 confirmations before running 'make deploy'

How many Cores would you like to connect to? (max 4) 2
Would you like to specify any Core IPs manually? No

You have chosen to connect to 2 Core(s).
You will now need to fund you wallet with a minimum amount of BTC to cover costs of the initial channel creation and future Core submissions.

? How many Satoshi to commit to each channel/Core? (min 120000) 500000
? 500000 per channel will require 1000000 Satoshi total funding. Is this OK? (Y/n) y

**************************************************************************************************************
Please send 1000000 Satoshi (0.01 BTC) to your wallet with address tb1qglvlrlg0velrserjuuy7s4uhrsrhuzwgl8hvgm
**************************************************************************************************************

This initialization process will now wait until your Lightning node is fully synced and your wallet is funded with at least 400000 Satoshi. The init process should resume automatically.

2020-02-24T17:12:12.244Z> Syncing in progress... currently at block height 1576000
2020-02-24T17:12:42.259Z> Syncing in progress... currently at block height 1596000
2020-02-24T17:13:12.269Z> Syncing in progress... currently at block height 1608000
2020-02-24T17:13:42.279Z> Syncing in progress... currently at block height 1626000
2020-02-24T17:14:12.286Z> Syncing in progress... currently at block height 1650000
2020-02-24T17:14:42.297Z> Syncing in progress... currently at block height 1662000

*****************************************
Your Lightning node is fully synced.
*****************************************

***********************************************
Your Lightning wallet is adequately funded.
***********************************************

*********************************************************************************
Chainpoint Gateway and integrated Lightning node have been successfully initialized.
*********************************************************************************

$ make deploy
```

After running `make deploy`, the Gateway will automatically peer and open Lightning channels with Cores. This may take up to 6 confirmations (~60 minutes). This will allow the Gateway to authenticate with Cores and pay for Anchor Fees. This process may take several minutes upon first run.

## Troubleshooting

If your issue isn't addressed here, please [submit an issue](https://github.com/chainpoint/chainpoint-core/issues) to the Chainpoint Core repo.

### Init Problems

If `make init` fails and the Lightning wallet hasn't yet been generated and funded, run `make init-restart`, then run `make init` again. If the Lightning wallet has already been generated and funded, you can usually just run `make init` again to continue the initialization process.

### Docker Secrets

Gateway uses docker secrets to store sensitive credentials. If you receive a `secret not found` error for either `HOT_WALLET_PASS` or `HOT_WALLET_ADDRESS` while deploying, this can be remedied by using your saved lnd credentials to recreate the secrets:
`printf <hot wallet password without quotes> | docker secret create HOT_WALLET_PASS -` or `printf <hot wallet address without quotes> | docker secret create HOT_WALLET_ADDRESS -`.

## Gateway Public API

Every Gateway provides a public HTTP API. This is documented in greater detail on the [Gateway HTTP API wiki](https://github.com/chainpoint/chainpoint-gateway/wiki/Gateway-HTTP-API)

Additionally, lightning node information for your Gateway can be found at `http://<gateway_ip>/config`.

## License

[Apache License, Version 2.0](https://opensource.org/licenses/Apache-2.0)

```text
Copyright (C) 2017-2020 Tierion

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
