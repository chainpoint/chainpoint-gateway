# Tierion Network Node

## About

A Tierion Network Node is a critical component of the Tierion Network. It allows anyone to accept hashes for anchoring to public blockchains and participate in the Tierion Network Token (TNT) ecosystem.

Nodes communicate with the Tierion Network Core, spending TNT to anchor hashes, and gaini eligibility to earn TNT by providing services to the Tierion Network.

In order to be eligible for earning TNT a Node must generally:

* have a registered unique Ethereum address
* maintain a minimum balance of TNT assigned to that Ethereum address
* provide network services to all clients on a public IP address, or hostname, and port
* pass all health checks from the network Core over a rolling window of time.

Tierion Network Nodes that do not meet all of these requirements are not eligible to earn TNT through periodic rewards.

## Important Notice

This repository contains the source code for the Tierion Network Node
software. The code in this repository is primarily intended for developer use. It is used to generate the public Docker images that are used by people wanting to run their own Node.

If you want to run your own Tierion Network Node please instead see the following repository which provides easy installation
and run instructions.

[https://github.com/chainpoint/chainpoint-node-run](https://github.com/chainpoint/chainpoint-node-run)

## Development

### Dependencies

The instructions on this page assume you have already installed both `docker` and `docker-compose`.

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
