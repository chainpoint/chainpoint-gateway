# First target in the Makefile is the default.
all: help

# without this 'source' won't work.
SHELL := /bin/bash

# Get the location of this makefile.
ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Specify the binary dependencies
REQUIRED_BINS := docker docker-compose gcloud
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
	@rm -rf ./.data/*

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
	mkdir -p ./.data/rocksdb && chmod 777 ./.data/rocksdb

## pull            : Pull Docker images
.PHONY : pull
pull:
	docker-compose pull

## git-pull        : Git pull latest
.PHONY : git-pull
git-pull:
	@git pull --all

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
	node cli/init.js

## rm-secrets               : Remove secrets
.PHONY : rm-secrets
rm-secrets:
	cli/scripts/remove_eth_account.sh

## deploy					: deploys a swarm stack
deploy:
	docker stack deploy -c swarm-compose.yaml chainpoint-node

## stop						: removes a swarm stack
stop:
	docker stack rm chainpoint-node

