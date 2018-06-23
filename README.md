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

### Connecting to Local Databases

You can connect to the local PostgreSQL or Redis data stores using preconfigured clients which are found in the `bin` directory. You do not need to locally install any client software to use these clients, they are provided as Docker container binaries. These clients wrappers are preconfigured to connect on the appropriate ports and with the appropriate user credentials.

Redis (exit with `control-d`)
(can also be run with `make redis`)

```
~ ./bin/redis-cli
127.0.0.1:6381>
```

PostgreSQL (exit with `control-d`)
(can also be run with `make postgres`)

```
~ ./bin/psql
psql (9.6.5)
Type "help" for help.

chainpoint=#
```

### Connect to Node Dashboard

Navigate to http://<node_ip_address> in a web browser. Your Node's Dashboard can be password protected if desired. By default you will need to supply the valid Ethereum Address you have used to register the particular node you are connecting to in order to authenticate successfully.

Node Dashboard Password Scenarios:
1. Default: Password is initially set to your Ethereum Address
2. Using a Custom Password: If you wish to specify your own password. Edit the '.env' file and add a new environment variable named 'CHAINPOINT_NODE_UI_PASSWORD' with the value of your new password assigned to it (ex. CHAINPOINT_NODE_UI_PASSWORD=password1)
3. PUBLIC Dashboard: You can optionally make your Node's Dashboard public to the web. Simply set 'CHAINPOINT_NODE_UI_PASSWORD=false'


## Node Public API

A Chainpoint Node exposes a public HTTP API that can:

* accept new hashes
* retrieve proofs with a hash ID
* verify proofs
* provide configuration and audit info
* provide verified calendar info


### API Documentation

The Node HTTP API has been documented using Swagger.
[https://app.swaggerhub.com/apis/chainpoint/node/1.0.0](https://app.swaggerhub.com/apis/chainpoint/node/1.0.0)

You can also use SwaggerHub to actually execute sample requests, and it will show you the `curl` commands needed to try it yourself.

### API Examples

The following `curl` samples have been 'prettified' with [jq](https://stedolan.github.io/jq/) for easier readbility.

#### Submit a Hash

Submit a single hash, or an Array of them at once.

```
curl -s -X POST "http://35.230.179.171/hashes" -H "accept: application/json" -H "content-type: application/json" -d "{ \"hashes\": [ \"1957db7fe23e4be1740ddeb941ddda7ae0a6b782e536a9e00b5aa82db1e84547\" ]}" | jq

{
  "meta": {
    "submitted_at": "2018-01-09T15:43:46Z",
    "processing_hints": {
      "cal": "2018-01-09T15:43:56Z",
      "eth": "2018-01-09T16:24:46Z",
      "btc": "2018-01-09T16:44:46Z"
    }
  },
  "hashes": [
    {
      "hash_id_node": "e0dab610-f553-11e7-963e-01d98c837763",
      "hash": "1957db7fe23e4be1740ddeb941ddda7ae0a6b782e536a9e00b5aa82db1e84547"
    }
  ]
}
```

#### Retrieve a Proof

Pass in the `hash_id_node` value from the previous step.

Pro Tip: Proofs can be retrieved in the supported
[Chainpoint binary](https://github.com/chainpoint/chainpoint-binary) format by passing an appropriate `Accept` header with your request.

Binary

```
...
-H 'Accept: application/vnd.chainpoint.json+base64'
...
```

JSON

```
...
-H 'Accept: application/vnd.chainpoint.ld+json'
...
```

Example:

```
curl -s -X GET "http://35.230.179.171/proofs/e0dab610-f553-11e7-963e-01d98c837763" -H "accept: application/vnd.chainpoint.ld+json" | jq

[
  {
    "hash_id_node": "e0dab610-f553-11e7-963e-01d98c837763",
    "proof": {
      "@context": "https://w3id.org/chainpoint/v3",
      "type": "Chainpoint",
      "hash": "1957db7fe23e4be1740ddeb941ddda7ae0a6b782e536a9e00b5aa82db1e84547",
      "hash_id_node": "e0dab610-f553-11e7-963e-01d98c837763",
      "hash_submitted_node_at": "2018-01-09T15:43:46Z",
      "hash_id_core": "e13ea800-f553-11e7-8b26-01bc617b4481",
      "hash_submitted_core_at": "2018-01-09T15:43:46Z",
      "branches": [
        {
          "label": "cal_anchor_branch",
          "ops": [
            {
              "l": "node_id:e0dab610-f553-11e7-963e-01d98c837763"
            },
            {
              "op": "sha-256"
            },
            {
              "l": "core_id:e13ea800-f553-11e7-8b26-01bc617b4481"
            },
            {
              "op": "sha-256"
            },
            {
              "l": "nist:1515512580:8be3a9cff9f539f430aa7218b5ad257f0652fe9881191e71633fbf00f4660c6e11c66476effaba612cb9fdc1ec58f543bc59d207b93581201da089c5d3d153be"
            },
            {
              "op": "sha-256"
            },
            {
              "r": "3451658019f4228cdc901130fd82cb8528580ce8af0291314fd30beea503ede5"
            },
            {
              "op": "sha-256"
            },
            {
              "l": "986692:1515512636:1:https://c.chainpoint.org:cal:986692"
            },
            {
              "r": "d5b9a270d3304d2f9912b1424409e98cb63a788c5cba55067a4e51a84b6dd07e"
            },
            {
              "op": "sha-256"
            },
            {
              "anchors": [
                {
                  "type": "cal",
                  "anchor_id": "986692",
                  "uris": [
                    "https://c.chainpoint.org/calendar/986692/hash"
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    "anchors_complete": [
      "cal"
    ]
  }
]
```

#### Verify a Proof

Pass in the proof output from the previous step.

Pro Tip: You can extract just the proof from that previous command using `jq`. There are more examples of how to use `jq` [here](https://stedolan.github.io/jq/tutorial/).

```
curl -s -X GET "http://35.230.179.171/proofs/e0dab610-f553-11e7-963e-01d98c837763" -H "accept: application/vnd.chainpoint.ld+json" | jq '.[0].proof'
```

Submit that proof as part of the `proofs` Array to verify it:

```
curl -s -X POST \
  http://35.230.179.171/verify \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
  -d '{"proofs": [
{
  "@context": "https://w3id.org/chainpoint/v3",
  "type": "Chainpoint",
  "hash": "1957db7fe23e4be1740ddeb941ddda7ae0a6b782e536a9e00b5aa82db1e84547",
  "hash_id_node": "e0dab610-f553-11e7-963e-01d98c837763",
  "hash_submitted_node_at": "2018-01-09T15:43:46Z",
  "hash_id_core": "e13ea800-f553-11e7-8b26-01bc617b4481",
  "hash_submitted_core_at": "2018-01-09T15:43:46Z",
  "branches": [
    {
      "label": "cal_anchor_branch",
      "ops": [
        {
          "l": "node_id:e0dab610-f553-11e7-963e-01d98c837763"
        },
        {
          "op": "sha-256"
        },
        {
          "l": "core_id:e13ea800-f553-11e7-8b26-01bc617b4481"
        },
        {
          "op": "sha-256"
        },
        {
          "l": "nist:1515512580:8be3a9cff9f539f430aa7218b5ad257f0652fe9881191e71633fbf00f4660c6e11c66476effaba612cb9fdc1ec58f543bc59d207b93581201da089c5d3d153be"
        },
        {
          "op": "sha-256"
        },
        {
          "r": "3451658019f4228cdc901130fd82cb8528580ce8af0291314fd30beea503ede5"
        },
        {
          "op": "sha-256"
        },
        {
          "l": "986692:1515512636:1:https://c.chainpoint.org:cal:986692"
        },
        {
          "r": "d5b9a270d3304d2f9912b1424409e98cb63a788c5cba55067a4e51a84b6dd07e"
        },
        {
          "op": "sha-256"
        },
        {
          "anchors": [
            {
              "type": "cal",
              "anchor_id": "986692",
              "uris": [
                "https://c.chainpoint.org/calendar/986692/hash"
              ]
            }
          ]
        }
      ]
    }
  ]
}
]}' | jq


[
  {
    "proof_index": 0,
    "hash": "1957db7fe23e4be1740ddeb941ddda7ae0a6b782e536a9e00b5aa82db1e84547",
    "hash_id_node": "e0dab610-f553-11e7-963e-01d98c837763",
    "hash_submitted_node_at": "2018-01-09T15:43:46Z",
    "hash_id_core": "e13ea800-f553-11e7-8b26-01bc617b4481",
    "hash_submitted_core_at": "2018-01-09T15:43:46Z",
    "anchors": [
      {
        "branch": "cal_anchor_branch",
        "type": "cal",
        "valid": true
      }
    ],
    "status": "verified"
  }
]
```

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
