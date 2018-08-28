# Chainpoint Node Source

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## About

Chainpoint Nodes allows anyone to run a server that accepts hashes, anchors them to public blockchains, create and verify proofs, and participate in the Chainpoint Network.

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
