# Chainpoint Node Source

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)



## What is Chainpoint Node?

Chainpoint Nodes allows anyone to run a server that accepts hashes, anchors them to public blockchains, and retrieves and verify the resulting proofs.

This repository contains the source code for the Chainpoint Node
software. The code in this repository is primarily intended for
developer use. It is used to generate the public Docker images that
are used by those wanting to run their own Node.



## Installing Chainpoint Node

### Requirements

At minimum, the following software is required for any installation of Core:

- `*Nix-based OS (Ubuntu Linux and MacOS have been tested)`
- `BASH`
- `Git`
- `Docker`

A BASH script to install all other dependencies (make, openssl, nodejs, yarn) on Ubuntu and Mac can be found [here](https://github.com/chainpoint/chainpoint-node-src/blob/master/scripts/install_deps.sh).

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



### Installation

Running the following commands in BASH will download and setup the Core installation:

```
git clone https://github.com/chainpoint/chainpoint-node-src.git
cd chainpoint-node-src
make init
```

The above make command will download all other dependencies and run an interactive setup wizard. The process is detailed in `Configuration` below.

### Initiating Your Chainpoint Node

First, you will have to run the following command to initate your Node:

```
make init
```

Chainpoint Node currently uses Docker Swarm when running in Production mode. Running `make init` will initialize a Docker Swarm node on the host machine. It is important that you securely store your new Ethereum private key displayed in the console after running the init command. Your Ethereum hot wallet address and private key will be stored as Docker Swarm secrets and accessed by the Chainpoint Node when needed. Subsequent `make` commands will use these new secrets to copmlete the Chainpoint Network registration process and assume its duties as an operating Chainpoint Node. The init command will also copy `.env.sample` to `.env`. The `.env` file will be used by `docker-compose` to set required environment variables. Please open the `.env` file and where appropriate edit any missing or default values.

Reference the `.env.sample` for detailed descriptions and examples of global environment variables Chainpoint Nodes use during operation.

### Starting Your Chainpoint Node

After initializing & configuring your Node, you can start your Node by running the following:

```
make deploy
```

This command will start your Node and grant it the ability to start interacting with the Chainpoint Network and accept incoming hashes from clients.

## Node Public API

Every Node provides a public HTTP API. This is documented in greater detail on the [Node HTTP API wiki](https://github.com/chainpoint/chainpoint-node/wiki/Node-HTTP-API)

# FAQs

## Initializing Your Node

### How is the Chainpoint Node using Docker Swarm Secrets?

The Chainpoint Node currently creates two secrets managed by Docker Swarm: 1) ETH_ADDRESS, 2) ETH_PRIVATE_KEY. You can view your systems secrets by running the following command: `docker secret ls`.

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
