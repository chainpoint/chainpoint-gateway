# First target in the Makefile is the default.
all: help

# without this 'source' won't work.
SHELL := /bin/bash

# Get the location of this makefile.
ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Get home directory of current users
NODE_DATADIR := $(shell eval printf "~$$USER")/.chainpoint/node

# Get home directory of current users
HOMEDIR := $(shell eval printf "~$$USER")
CORE_DATADIR := ${HOMEDIR}/.chainpoint/core

UID := $(shell id -u $$USER)
GID := $(shell id -g $$USER)

.PHONY : help
help : Makefile
	@sed -n 's/^##//p' $<

## logs            : Tail Node logs
.PHONY : logs
logs:
	docker-compose logs -f -t | grep chainpoint-node

## up              : Start Node
.PHONY : up
up: build-config build build-rocksdb
	docker-compose up -d

## down            : Shutdown Node
.PHONY : down
down:
	docker-compose down

## clean           : Shutdown and **destroy** all local Node data
.PHONY : clean
clean: down
	@sudo rm -rf ${NODE_DATADIR}/data/rocksdb/*
	@sudo chmod 777 ${NODE_DATADIR}/data/rocksdb

## burn            : Shutdown and **destroy** all local Node data
.PHONY : burn
burn: clean
	@sudo rm -rf ${HOMEDIR}/.chainpoint/node/.lnd

## restart         : Restart Node
.PHONY : restart
restart: down up

## build           : Build Node image
.PHONY : build
build:
	docker build -t chainpoint-node .
	docker tag chainpoint-node gcr.io/chainpoint-registry/github-chainpoint-chainpoint-node-src:latest
	docker container prune -f

## build-config    : Copy the .env config from .env.sample
.PHONY : build-config
build-config:
	@[ ! -f ./.env ] && \
		cp .env.sample .env && \
		echo 'Copied config .env.sample to .env' || true

## build-rocksdb   : Ensure the RocksDB data dir exists
.PHONY : build-rocksdb
build-rocksdb:
	@echo Setting up directories...
	@mkdir -p ${NODE_DATADIR}/data/rocksdb && chmod 777 ${NODE_DATADIR}/data/rocksdb

## pull            : Pull Docker images
.PHONY : pull
pull:
	docker-compose pull

## git-pull        : Git pull latest
.PHONY : git-pull
git-pull:
	@git pull --all
	@git submodule update --init --remote --recursive

## upgrade         : Same as `make down && git pull && make up`
.PHONY : upgrade
upgrade: down git-pull up

## install-deps	         : Install system dependencies
install-deps:
	scripts/install_deps.sh
	echo Please login and logout to enable docker

## init	         : Bring up yarn, swarm, and generate secrets
init: build-rocksdb init-yarn init-swarm

## init-yarn       : Initialize dependencies
init-yarn:
	@echo Installing packages...
	@yarn >/dev/null

## init-swarm      : Initialize a docker swarm
.PHONY : init-swarm
init-swarm:
	@node ./init/index.js

## init-swarm-restart     : Initialize a docker swarm, abandon current configuration
.PHONY : init-swarm-restart
init-swarm-restart:
	@docker-compose down &> /dev/null
	@rm -rf ~/.chainpoint/node/.lnd
	@rm -rf ./init/init.json
	@node ./init/index.js

## init-restart         : Bring up yarn, swarm, and generate secrets, abondon current configuration
init-restart: build-rocksdb init-yarn init-swarm-restart

## deploy          : deploys a swarm stack
deploy:
	set -a && source .env && set +a && export USERID=${UID} && export GROUPID=${GID} && docker stack deploy -c swarm-compose.yaml chainpoint-node

## optimize-network: increases number of sockets host can use
optimize-network:
	@sudo sysctl net.core.somaxconn=1024
	@sudo sysctl net.ipv4.tcp_fin_timeout=30
	@sudo sysctl net.ipv4.tcp_tw_reuse=1
	@sudo sysctl net.core.netdev_max_backlog=2000
	@sudo sysctl net.ipv4.tcp_max_syn_backlog=2048

## stop	         : removes a swarm stack
stop:
	docker stack rm chainpoint-node
	rm -rf ${HOMEDIR}/.chainpoint/node/.lnd/tls.*
