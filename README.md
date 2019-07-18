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
- `Docker`

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

First, you will have to run the following command to initate your Node:

```
make init
```

After running the initiation command above, you will now have a newly generated Ethereum hot wallet. This wallet will need an adequate amount of ETH to cover future Ethereum transaction fees for registering into the Chainpoint Network, and the purchase Usage Tokens that grant your Node access to participate in the Network for durations of time.

Chainpoint Node currently uses Docker Swarm when running in Production mode. Running `make init` will initialize a Docker Swarm node on the host machine. It is important that you securely store your new Ethereum private key displayed in the console after running the init command. Your Ethereum hot wallet address and private key will be stored as Docker Swarm secrets and accessed by the Chainpoint Node when needed. Subsequent `make` commands will use these new secrets to copmlete the Chainpoint Network registration process and assume its duties as an operating Chainpoint Node. The init command will also copy `.env.sample` to `.env`. The `.env` file will be used by `docker-compose` to set required environment variables. Please open the `.env` file and where appropriate edit any missing or default values.

Reference the `.env.sample` for detailed descriptions and examples of global environment variables Chainpoint Nodes use during operation.

### Registering Your Chainpoint Node

After configuring your Node, if you wish to join a public network, you must complete the registration steps listed below.

An interactive registration process can be prompted by running the following commnad:

```
make register
```

Please fill out the interactive form to begin the registration process. Note, make sure you have sent a small amount of Ethereum and enough \$TKNs to cover the registration amount to your Node's ethereum hot wallet address before attempting to register.

The registration process consists of two Ethereum transactions created by your Chainpoint Node and broadcast to the Ethereum Network: 1) Invoking the `approve()` method of the $TKN contract to allow the Chainpoint Registry contract to transfer a predefined amount of $TKNs for registration, 2) Invoking the `stake()` method of the Chainpoint Registry contract to create a record for your Node within the Chainpoint Registry and stake your \$TKNs for the duration of your Node's registration.

The registration process can take up to a few minutes. If your Node experiences trouble registering, please reference the FAQ section.

### Starting Your Chainpoint Node

After initializing & configuring your Node, you can start your Node by running the following:

```
make deploy
```

This command will start your Node and grant it the ability to start interacting with the Chainpoint Network and accept incoming hashes from clients.

### Connect to Node Dashboard

Navigate to `http://<node_ip_address>` in a web browser. Your Node's Dashboard can be password protected if desired. By default you will need to supply the valid Ethereum Address you have used to register the particular node you are connecting to in order to authenticate successfully.

Node Dashboard Password Scenarios:

1. Default: Password is initially set to your Ethereum Address
2. Using a Custom Password: If you wish to specify your own password. Edit the '.env' file and add a new environment variable named 'CHAINPOINT_NODE_UI_PASSWORD' with the value of your new password assigned to it (ex. CHAINPOINT_NODE_UI_PASSWORD=password1)
3. PUBLIC Dashboard: You can optionally make your Node's Dashboard public to the web. Simply set 'CHAINPOINT_NODE_UI_PASSWORD=false'

## Node Public API

Every Node provides a public HTTP API. This is documented in greater detail on the [Node HTTP API wiki](https://github.com/chainpoint/chainpoint-node/wiki/Node-HTTP-API)

# FAQs

## Initializing Your Node

### How is the Chainpoint Node using Docker Swarm Secrets?

The Chainpoint Node currently creates two secrets managed by Docker Swarm: 1) ETH_ADDRESS, 2) ETH_PRIVATE_KEY. You can view your systems secrets by running the following command: `docker secret ls`.

### How can I generate a new Ethereum Hot Wallet for my Node?

Start by purging existing Docker swarm secrets by running:

```
docker swarm leave --force
```

After leaving the swarm, you can run `make init` to re-initiazlie your Node and create a new Ethereum hot wallet. NOTE: that after running the above commands, your node containing new Ethereum credentials will not be registered onto the Chainpoint Network, thus must follow the registration steps listed above - "Registering Your Chainpoint Node"

## Registering Your Node

### Why is my Node failing to register?

The two most common reasons why your node is failing to register are as follows: 1) you have forgotten to send a small amount of ETH to cover ethereum transaction gas costs, 2) you have forgotten to send the min. amount of \$TKNs to meet the staking requirement.

Please make sure that your Node's Ethereum hot wallet address has the appropriate amount of ETH & \$TKN

### My Node has enough ETH & \$TKNs to cover registration but is still failing to register. Why?

Please make sure that you have not previously registered onto the Chainpoint Network using previously. The Chainpoint Network enforces a unique pair of Ethereum Address and IPv4 addresses to successfully register. You can query the Chainpoint Registry smart contract to verify if the Ethereum address and IPv4 address are unique.

### I'm still experiencing Node Registration problems, what can I do?

If you are experiencing persistent registration issues, try following the steps towards re-initializing your node which will result in a new Ethereum Hot Wallet that you can use to attempt to register onto the Chainpoint Network

## Usage Tokens

### How do I acquire a Usage Token for my Node?

The acquisition of Usage Tokens is an automated process that begins once your Chainpoint Node has been fully bootstrapped and started. There is a cost associated in purchasing Usage Tokens so make sure that your Node's Ethereum Hot Wallet has enough \$TKNs to cover the purchase cost.

### What happens when my Node's Usage Token runs out of Credit(s)?

The Node will automatically identify when its Usage Token has expired and will trigger an automatic process to purchase a new Usage Token. Please make sure that your Node's Ethereum hot wallet has a sufficient amount of \$TKNs to cover the purchase cost.

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
