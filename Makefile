# First target in the Makefile is the default.
all: help

# without this 'source' won't work.
SHELL := /bin/bash

# Get the location of this makefile.
ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Get home directory of current users
NODE_DATADIR := $(shell eval printf "~$$USER")/.chainpoint/node

# Specify the binary dependencies
REQUIRED_BINS := docker docker-compose
$(foreach bin,$(REQUIRED_BINS),\
	$(if $(shell command -v $(bin) 2> /dev/null),$(),$(error Please install `$(bin)` first!)))

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
	docker-compose up -d --no-build

## down            : Shutdown Node
.PHONY : down
down:
	docker-compose down

## clean           : Shutdown and **destroy** all local Node data
.PHONY : clean
clean: down
	@sudo rm -rf ${NODE_DATADIR}/data/rocksdb/*
	@sudo chmod 777 ${NODE_DATADIR}/data/rocksdb

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
	mkdir -p ${NODE_DATADIR}/data/rocksdb && chmod 777 ${NODE_DATADIR}/data/rocksdb

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

## init						: Bring up yarn, swarm, and generate secrets
init: init-yarn init-swarm init-secrets

## init-yarn				: Initialize dependencies
init-yarn:
	@yarn

## init-swarm               : Initialize a docker swarm
.PHONY : init-swarm
init-swarm:
	@docker swarm init || echo "Swarm already initialized"

## init-secrets             : Generate necessary secrets
.PHONY : init-secrets
init-secrets:
	node cli/init.js FORCE=$(FORCE)

## Register					: Register Node to Chainpoint Network
register:
	set -a && source .env && set +a && docker stack deploy -c swarm-compose.registration.yaml chainpoint-registration
	cli/run_registration.sh

## Register					: Register Node to Chainpoint Network
update-registration:
	docker exec -ti `docker ps -q` bash -c "source cli/scripts/env_secrets_expand.sh && node cli/update_registration.js NODE_PUBLIC_IP_ADDRESS=$(NODE_PUBLIC_IP_ADDRESS)"

## De-Register					: De-Register Node to Chainpoint Network
deregister:
	docker exec -ti `docker ps -q` bash -c "source cli/scripts/env_secrets_expand.sh && node cli/deregister.js"

## rm-secrets               : Remove secrets
.PHONY : rm-secrets
rm-secrets:
	cli/scripts/remove_eth_account.sh

## deploy					: deploys a swarm stack
deploy:
	set -a && source .env && set +a && docker stack deploy -c swarm-compose.yaml chainpoint-node

## stop						: removes a swarm stack
stop:
	docker stack rm chainpoint-node

%:      # Enables support for cli arguments used in commands like "make stake"
    @:
