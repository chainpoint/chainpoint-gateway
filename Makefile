# First target in the Makefile is the default.
all: help

# without this 'source' won't work.
SHELL := /bin/bash

# Get the location of this makefile.
ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Specify the binary dependencies
REQUIRED_BINS := docker docker-compose
$(foreach bin,$(REQUIRED_BINS),\
    $(if $(shell command -v $(bin) 2> /dev/null),$(),$(error Please install `$(bin)` first!)))

# Ask Tnt Address
TNT_ADDRESS_ANSWER ?= $(shell bash -c 'read -p "Write your TNT Address: " input_tnt_addr; echo $$input_tnt_addr')

# Get Public Ip Address
LOOKUP_PUBLIC_IP_ADDRESS ?= $(shell bash -c 'curl --connect-timeout 2 -s http://icanhazip.com/')

# Ask Public Ip Address
TNT_PUBLIC_HOST_ANSWER ?= $(shell bash -c 'read -p "Write your TNT Node Public Host Address: We found your ip address $(LOOKUP_PUBLIC_IP_ADDRESS) write y and press enter. If Ip Address is not true write your Ip address: " input_ip_addr; if [ $$input_ip_addr == "y" ]; then echo $(LOOKUP_PUBLIC_IP_ADDRESS); else echo $$input_ip_addr; fi ' )

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
build:
	./bin/docker-make --no-push
	docker container prune -f
	docker-compose build

## easy-setup	 : Easy Chain Point Node Setup
.PHONY : easy-setup
easy-setup: build-config
	@sed -i '' 's/^\(NODE_TNT_ADDRESS=\).*/\1$(TNT_ADDRESS_ANSWER)/' .env
	@sed -i '' 's/^\(CHAINPOINT_NODE_PUBLIC_URI=\).*/\1http:\/\/$(TNT_PUBLIC_HOST_ANSWER)/' .env
	@echo 'Setup finished'
	docker-compose up -d --no-build

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
	@git pull

## upgrade         : Same as `make down && git pull && make up`
.PHONY : upgrade
upgrade: down git-pull up

## push            : Push Docker images using docker-make
.PHONY : push
push:
	./bin/docker-make

## clean           : Shutdown and **destroy** all local Node data
.PHONY : clean
clean: down
	@rm -rf ./.data/*

## yarn            : Install Node Javascript dependencies
.PHONY : yarn
yarn:
	./bin/yarn

## postgres        : Connect to the local PostgreSQL with `psql`
.PHONY : postgres
postgres:
	@docker-compose up -d postgres
	@sleep 4
	@./bin/psql

## redis           : Connect to the local Redis with `redis-cli`
.PHONY : redis
redis:
	@docker-compose up -d redis
	@sleep 2
	@./bin/redis-cli

## auth-keys       : Export HMAC auth keys from PostgreSQL
.PHONY : auth-keys
auth-keys: up
	@sleep 4
	@echo ''
	@./bin/psql -c 'SELECT * FROM hmackey;'

## auth-key-update : Update HMAC auth key with `KEY` (hex string) var. Example `make update-auth-key KEY=mysecrethexkey`
.PHONY : auth-key-update
auth-key-update: guard-KEY up
	@sleep 8
	@source .env && ./bin/psql -c "INSERT INTO hmackey (tnt_addr, hmac_key) VALUES (LOWER('$$NODE_TNT_ADDRESS'), LOWER('$(KEY)')) ON CONFLICT (tnt_addr) DO UPDATE SET hmac_key = LOWER('$(KEY)')"
	make restart

## auth-key-delete : Delete HMAC auth key with `NODE_TNT_ADDRESS` var. Example `make auth-key-delete NODE_TNT_ADDRESS=0xmyethaddress`
.PHONY : auth-key-delete
auth-key-delete: guard-NODE_TNT_ADDRESS up
	@sleep 4
	./bin/psql -c "DELETE FROM hmackey WHERE tnt_addr = LOWER('$(NODE_TNT_ADDRESS)')"
	make restart

guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi
