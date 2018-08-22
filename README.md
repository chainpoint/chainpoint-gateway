# Chainpoint Node Source

[![JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## About

Chainpoint Nodes are a critical component of the Chainpoint Network. Nodes
allows anyone to run a server that accepts hashes, anchor them to public
blockchains, verify proofs, and participate in the Chainpoint Network
Token (TNT) ecosystem.

This repository contains the source code for the Chainpoint Node
software. The code in this repository is primarily intended for
developer use. It is used to generate the public Docker images that
are used by those wanting to run their own Node.

If you want to run your own Chainpoint Node please instead
see the following repository which provides installation
and run instructions.

[https://github.com/chainpoint/chainpoint-node](https://github.com/chainpoint/chainpoint-node)

## Development

### Prerequisites

In order to run a Node in development these instructions assume
you have already installed both the `docker` and `docker-compose`
commands as appropriate for your system.

### Running

```
cd chainpoint-node

# Copy the `.env.sample` to `.env`
make build-config

# Edit the .env file to add your Ethereum address
vi .env

make up
```

Run `make help` to learn about additional control and build commands.

### Connect to Node Dashboard

Navigate to http://<node_ip_address> in a web browser. Your Node's Dashboard can be password protected if desired. By default you will need to supply the valid Ethereum Address you have used to register the particular node you are connecting to in order to authenticate successfully.

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

