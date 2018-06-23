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

## up              : Start Node
.PHONY : up
up: build-config yarn build
	docker-compose up -d --no-build

## down            : Shutdown Node
.PHONY : down
down:
	docker-compose down

## restart         : Restart Node
.PHONY : restart
restart: down up

## logs            : Tail Node logs
.PHONY : logs
logs:
	docker-compose logs -f -t | grep chainpoint-node

## logs-redis      : Tail Redis logs
.PHONY : logs-redis
logs-redis:
	docker-compose logs -f -t | grep redis

## logs-postgres   : Tail PostgreSQL logs
.PHONY : logs-postgres
logs-postgres:
	docker-compose logs -f -t | grep postgres

## logs-all        : Tail all logs
.PHONY : logs-all
logs-all:
	docker-compose logs -f -t

## ps              : View running processes
.PHONY : ps
ps:
	docker-compose ps

## build           : Build Node image
.PHONY : build
build: tor-exit-nodes
	docker build -t chainpoint-node .
	docker tag chainpoint-node gcr.io/chainpoint-registry/github-chainpoint-chainpoint-ntpd
	docker container prune -f
	docker-compose build

## build-config    : Copy the .env config from .env.sample
.PHONY : build-config
build-config:
	@[ ! -f ./.env ] && \
	cp .env.sample .env && \
	echo 'Copied config .env.sample to .env' || true

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

## clean           : Shutdown and **destroy** all local Node data
.PHONY : clean
clean: down
	@rm -rf ./.data/*

## yarn            : Install Node Javascript dependencies
.PHONY : yarn
yarn:
	docker run -it --rm --volume "$(PWD)":/usr/src/app --volume /var/run/docker.sock:/var/run/docker.sock --volume ~/.docker:/root/.docker --volume "$(PWD)":/wd --workdir /wd gcr.io/chainpoint-registry/chainpoint-node:latest yarn

## postgres        : Connect to the local PostgreSQL with `psql`
.PHONY : postgres
postgres:
	@docker-compose up -d postgres
	@sleep 6
	@docker exec -it postgres-node-src psql -U chainpoint

## redis           : Connect to the local Redis with `redis-cli`
.PHONY : redis
redis:
	@docker-compose up -d redis
	@sleep 2
	@docker exec -it redis-node-src redis-cli

## backup-auth-keys: Backup HMAC Auth keys to the 'keys/backups' dir
.PHONY : backup-auth-keys
backup-auth-keys: up
	@docker exec -it chainpoint-node-src_chainpoint-node_1 node auth-keys-backup.js

## print-auth-keys : Print to console the name and contents of auth key (HMAC) backups
.PHONY : print-auth-keys
print-auth-keys: up
	@docker exec -it chainpoint-node-src_chainpoint-node_1 node auth-keys-print.js

## calendar-delete : Delete all calendar data for this Node
.PHONY : calendar-delete
calendar-delete: 
	@docker-compose up -d postgres
	@sleep 6
	@docker exec -it postgres-node-src psql -U chainpoint -c "DELETE FROM calendar"
	make restart

guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi

## tor-exit-nodes  : Update static list of Exit Nodes
.PHONY : tor-exit-nodes
tor-exit-nodes:
	curl -s https://check.torproject.org/exit-addresses | grep ExitAddress | cut -d' ' -f2 > ./tor-exit-nodes.txt
