# Chainpoint Node Source

[![JavaScript Style Guide](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## About

Chainpoint Nodes are a critical component of the Tierion Network. Nodes
allows anyone to run a server that accepts hashes, anchor them to public
blockchains, verify proofs, and participate in the Tierion Network
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
curl -s -X POST "http://35.188.224.112/hashes" -H "accept: application/json" -H "content-type: application/json" -d "{ \"hashes\": [ \"1957db7fe23e4be1740ddeb941ddda7ae0a6b782e536a9e00b5aa82db1e84547\" ]}" | jq

{
  "meta": {
    "submitted_at": "2017-09-15T16:47:54Z",
    "processing_hints": {
      "cal": "2017-09-15T16:48:04Z",
      "eth": "2017-09-15T17:28:54Z",
      "btc": "2017-09-15T17:48:54Z"
    }
  },
  "hashes": [
    {
      "hash_id_node": "9ed605e0-9a35-11e7-b652-01397d29af71",
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
-H 'Accept: application/vnd.chainpoint.api.v1.base64+json'
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
curl -s -X GET "http://35.188.224.112/proofs/9ed605e0-9a35-11e7-b652-01397d29af71" -H "accept: application/vnd.chainpoint.ld+json" | jq

[
  {
    "hash_id_node": "9ed605e0-9a35-11e7-b652-01397d29af71",
    "proof": {
      "@context": "https://w3id.org/chainpoint/v3",
      "type": "Chainpoint",
      "hash": "1957db7fe23e4be1740ddeb941ddda7ae0a6b782e536a9e00b5aa82db1e84547",
      "hash_id_node": "9ed605e0-9a35-11e7-b652-01397d29af71",
      "hash_submitted_node_at": "2017-09-15T16:47:54Z",
      "hash_id_core": "9f169150-9a35-11e7-997c-01f36f7b0210",
      "hash_submitted_core_at": "2017-09-15T16:47:55Z",
      "branches": [
        {
          "label": "cal_anchor_branch",
          "ops": [
            {
              "l": "node_id:9ed605e0-9a35-11e7-b652-01397d29af71"
            },
            {
              "op": "sha-256"
            },
            {
              "l": "core_id:9f169150-9a35-11e7-997c-01f36f7b0210"
            },
            {
              "op": "sha-256"
            },
            {
              "l": "nist:1505494020:9041b2df21da43ef46c839e3573acd5faf35b35e2e45bc7a7beb6f07ea3314908c8ba26535535cb1385edbc04adb12986536319628a159b494537e98aed3e988"
            },
            {
              "op": "sha-256"
            },
            {
              "r": "c8d9a7118d3cfd95eb40c846457103365c02c5f29e53824c20a4c0448bd42410"
            },
            {
              "op": "sha-256"
            },
            {
              "l": "15483:1505494080:1:https://b.chainpoint.org:cal:15483"
            },
            {
              "r": "5ebc6eafddca8f91a01831452a37b90dfb827a44f5f6d2cf20ce60730ee2e7f2"
            },
            {
              "op": "sha-256"
            },
            {
              "anchors": [
                {
                  "type": "cal",
                  "anchor_id": "15483",
                  "uris": [
                    "https://b.chainpoint.org/calendar/15483/hash"
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
curl -s -X GET "http://35.188.224.112/proofs/9ed605e0-9a35-11e7-b652-01397d29af71" -H "accept: application/vnd.chainpoint.ld+json" | jq '.[0].proof'
```

Submit that proof as part of the `proofs` Array to verify it:

```
curl -s -X POST \
  http://35.188.224.112/verify \
  -H 'cache-control: no-cache' \
  -H 'content-type: application/json' \
  -d '{"proofs": [ 
{
  "@context": "https://w3id.org/chainpoint/v3",
  "type": "Chainpoint",
  "hash": "1957db7fe23e4be1740ddeb941ddda7ae0a6b782e536a9e00b5aa82db1e84547",
  "hash_id_node": "9ed605e0-9a35-11e7-b652-01397d29af71",
  "hash_submitted_node_at": "2017-09-15T16:47:54Z",
  "hash_id_core": "9f169150-9a35-11e7-997c-01f36f7b0210",
  "hash_submitted_core_at": "2017-09-15T16:47:55Z",
  "branches": [
    {
      "label": "cal_anchor_branch",
      "ops": [
        {
          "l": "node_id:9ed605e0-9a35-11e7-b652-01397d29af71"
        },
        {
          "op": "sha-256"
        },
        {
          "l": "core_id:9f169150-9a35-11e7-997c-01f36f7b0210"
        },
        {
          "op": "sha-256"
        },
        {
          "l": "nist:1505494020:9041b2df21da43ef46c839e3573acd5faf35b35e2e45bc7a7beb6f07ea3314908c8ba26535535cb1385edbc04adb12986536319628a159b494537e98aed3e988"
        },
        {
          "op": "sha-256"
        },
        {
          "r": "c8d9a7118d3cfd95eb40c846457103365c02c5f29e53824c20a4c0448bd42410"
        },
        {
          "op": "sha-256"
        },
        {
          "l": "15483:1505494080:1:https://b.chainpoint.org:cal:15483"
        },
        {
          "r": "5ebc6eafddca8f91a01831452a37b90dfb827a44f5f6d2cf20ce60730ee2e7f2"
        },
        {
          "op": "sha-256"
        },
        {
          "anchors": [
            {
              "type": "cal",
              "anchor_id": "15483",
              "uris": [
                "https://b.chainpoint.org/calendar/15483/hash"
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
    "hash_id_node": "9ed605e0-9a35-11e7-b652-01397d29af71",
    "hash_submitted_node_at": "2017-09-15T16:47:54Z",
    "hash_id_core": "9f169150-9a35-11e7-997c-01f36f7b0210",
    "hash_submitted_core_at": "2017-09-15T16:47:55Z",
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

```
Copyright (C) 2017 Tierion

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
