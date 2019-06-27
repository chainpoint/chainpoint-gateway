# Chainpoint Node Source

## TODO: Update content to reflect new version

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

# Important Notice

This software is intended to be run as part of Chainpoint Network V3. It is for operators wanting to help run the anchoring service. If you are interested in running a Chainpoint Core, or installing a copy of our command line interface please instead visit:

https://github.com/chainpoint/chainpoint-core

https://github.com/chainpoint/chainpoint-cli

## Introduction to Chainpoint

Chainpoint is a protocol for facilitating the decentralized notarization of data using the Bitcoin blockchain. It makes the process of _anchoring_ data fingerprints (hashes) to Bitcoin more cost-effective by creating intermediate, decentralized tiers between the user and the Bitcoin blockchain.

The first tier is the [Chainpoint Node](https://github.com/chainpoint/chainpoint-node-src), which [_aggregates_](https://github.com/Tierion/merkle-tools) user submissions into a single datapoint every minute. This datapoint is then submitted to the second tier, the Chainpoint Core Network.
The Core Network consists of many Cores running in concert to create a Tendermint-based blockchain, the Calendar. Every hour, a random Core is elected to anchor the state of the Calendar to Bitcoin, then write back the result to the Calendar. The more Cores there are, the less frequently a given Core will be selected to anchor, which reduces the burden of paying Bitcoin fees.

After the Cores anchor to Bitcoin, the Chainpoint Nodes retrieve the result and construct a [cryptographic proof](https://github.com/chainpoint/chainpoint-cli) showing the user's data was included in the Bitcoin blockchain. Because the Bitcoin blockchain is viewable by everyone and secured by Bitcoin Mining, writing data to Bitcoin constitutes a reliable form of notarization-
it is a good way of attesting to the existence of certain data (ie proving you knew something) at a particular point in time.

Users can install a release of [Chainpoint-CLI](https://github.com/chainpoint/chainpoint-cli) to submit data to a Chainpoint Node and retrieve a [Chainpoint Proof](https://chainpoint.org/#v3x).

## What is Chainpoint Node?

Chainpoint Nodes allows anyone to run a server that accepts hashes, anchors them to public blockchains, create and verify proofs, and participate in the Chainpoint Network.

This repository contains the source code for the Chainpoint Node
software. The code in this repository is primarily intended for
developer use. It is used to generate the public Docker images that
are used by those wanting to run their own Node.

If you want to run your own Chainpoint Node please instead
see the following repository which provides installation
and run instructions.

[https://github.com/chainpoint/chainpoint-node](https://github.com/chainpoint/chainpoint-node)

## Installing Chainpoint Core

### Requirements

#### Hardware

Chainpoint Node has been tested with a couple of different hardware configurations.

Minimum:

- `>= 4GB RAM`
- `>= 1 CPU Cores`
- `128+ GB SSD`
- `Public IPv4 address`

Recommended:

- `>= 8GB RAM`
- `>= 2 CPU Cores`
- `256+ GB SSD`
- `Public IPv4 address`

#### Software

At minimum, the following software is required for any installation of Core:

- `*Nix-based OS (Ubuntu Linux and MacOS have been tested)`
- `BASH`
- `Git`

Provided BASH is installed, a script to install all other dependencies (make, openssl, nodejs, yarn) on Ubuntu and Mac can be found [here](https://github.com/chainpoint/chainpoint-core/blob/master/cli/scripts/install_deps.sh).

### Installation

Running the following commands in BASH will download and setup the Core installation:

```
git clone https://github.com/chainpoint/chainpoint-node-src.git
cd chainpoint-node-src
make init
```

The above make command will download all other dependencies and run an interactive setup wizard. The process is detailed in `Configuration` below.

### Configuration

After running the installation commands above, you will need to send an appropriate balance of ETH & \$TKN. Your newly generated hot wallet will need an adequate amount of ETH to cover future Ethereum transaction fees for registering into the Chainpoint Network, and purchase Usage Tokens that grant your Node access to participate in the Network for durations of time.

Chainpoint Node currently uses Docker Swarm when running in Production mode. Running `make init` will initialize a Docker Swarm node on the host machine and generate a new hot wallet. It is important that you securely store your new Ethereum private key. Subsequent `make` commands will continue the configuration and Chainpoint Network registration process. All secrets will be stored in Swarm's secrets system.
This command will also copy `.env.sample` to `.env`. The `.env` file will be used by `docker-compose` to set required environment variables.

There are further settings found in the `.env.sample` and `swarm-compose.yaml` file.
These are more permanent and altering them may cause problems connecting to the public Chainpoint testnets and mainnet.
However, they may be invaluable for setting up a private Chainpoint Network with different parameters, for example by configuring more frequent bitcoin anchoring or excluding the smart contract registration requirement.

## Development

### Prerequisites

In order to run a Node in development these instructions assume
you have already installed both the `docker` and `docker-compose`
commands as appropriate for your system.

### Code Formatting & Linting

This project makes use of [Prettier](https://prettier.io/) & [ESLint](https://eslint.org/) to maintain clean, and consistently styled, code.

You can run ESLint manually using the CLI:

For the Chainpoint Node JS Source:

```sh
./node_modules/.bin/eslint . --ignore-pattern '/ui/'
```

For the Chainpoint Node UI:

```sh
./node_modules/.bin/eslint ./ui/
```

You can run Prettier manually to see which files would be re-formatted by it. For example:

```sh
./node_modules/.bin/prettier -l lib/**/*.js
```

This project is coded in the [Visual Studio Code](https://code.visualstudio.com/) IDE and we use the following plugins to auto-format and report on linting issues during development:

[vscode-eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

[EditorConfig](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)

### Running The Server

```sh
cd chainpoint-node

# Copy the `.env.sample` to `.env`
make build-config

# Edit the .env file as appropriate
# Note that in development you'll likely want
# to leave the `CHAINPOINT_NODE_PUBLIC_URI`
# value empty to run a private Node.
vi .env

make up
```

Run `make help` to learn about additional control and build commands.

### Connect to Node Dashboard

Navigate to `http://<node_ip_address>` in a web browser. Your Node's Dashboard can be password protected if desired. By default you will need to supply the valid Ethereum Address you have used to register the particular node you are connecting to in order to authenticate successfully.

Node Dashboard Password Scenarios:

1. Default: Password is initially set to your Ethereum Address
2. Using a Custom Password: If you wish to specify your own password. Edit the '.env' file and add a new environment variable named 'CHAINPOINT_NODE_UI_PASSWORD' with the value of your new password assigned to it (ex. CHAINPOINT_NODE_UI_PASSWORD=password1)
3. PUBLIC Dashboard: You can optionally make your Node's Dashboard public to the web. Simply set 'CHAINPOINT_NODE_UI_PASSWORD=false'

## Node Public API

Every Node provides a public HTTP API. This is documented in greater detail on the [Node HTTP API wiki](https://github.com/chainpoint/chainpoint-node/wiki/Node-HTTP-API)

## License

[Apache License, Version 2.0](https://opensource.org/licenses/Apache-2.0)

```text
Copyright (C) 2017-2018 Tierion

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
