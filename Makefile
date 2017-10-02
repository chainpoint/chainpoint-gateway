# First target in the Makefile is the default.
all: help

# Get the location of this makefile.
ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Specify the binary dependencies
REQUIRED_BINS := docker docker-compose
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
build:
	./bin/docker-make --no-push
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
	@echo ''
	@./bin/psql -c 'SELECT * FROM hmackey;'

## auth-key-update : Update HMAC auth key with `KEY` (hex string) var. Example `make update-auth-key KEY=mysecrethexkey`
.PHONY : auth-key-update
auth-key-update: guard-KEY up
	@source .env && ./bin/psql -c "INSERT INTO hmackey (tnt_addr, hmac_key) VALUES (LOWER('$$NODE_TNT_ADDRESS'), LOWER('$(KEY)')) ON CONFLICT (tnt_addr) DO UPDATE SET hmac_key = LOWER('$(KEY)')"
	make restart

## auth-key-delete : Delete HMAC auth key with `NODE_TNT_ADDRESS` var. Example `make auth-key-delete NODE_TNT_ADDRESS=0xmyethaddress`
.PHONY : auth-key-delete
auth-key-delete: guard-NODE_TNT_ADDRESS up
	./bin/psql -c "DELETE FROM hmackey WHERE tnt_addr = LOWER('$(NODE_TNT_ADDRESS)')"
	make restart

guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi
