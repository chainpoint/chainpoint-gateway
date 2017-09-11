# First target in the Makefile is the default.
all: up

# Get the location of this makefile.
ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

# Specify the binary dependencies
REQUIRED_BINS := docker docker-compose
$(foreach bin,$(REQUIRED_BINS),\
    $(if $(shell command -v $(bin) 2> /dev/null),$(info Found `$(bin)`),$(error Please install `$(bin)`)))

# Help Text Display
# Usage: Put a comment with double # prior to targets.
# See : https://gist.github.com/rcmachado/af3db315e31383502660
## Display this help text
help: 
	$(info Available targets)
	@awk '/^[a-zA-Z\-\_0-9]+:/ {                    \
		nb = sub( /^## /, "", helpMsg );            \
		if(nb == 0) {                               \
		helpMsg = $$0;                              \
		nb = sub( /^[^:]*:.* ## /, "", helpMsg );   \
		}                                           \
		if (nb)                                     \
		print  $$1 "\t" helpMsg;                    \
	}                                               \
	{ helpMsg = $$0 }'                              \
	$(MAKEFILE_LIST) | column -ts $$'\t' |          \
	grep --color '^[^ ]*'

## Copy the .env config from .env.sample if not present
build-config:
	@[ ! -f ./.env ] && \
	cp .env.sample .env && \
	echo 'Copied config .env.sample to .env' || true

## Build Node
build:
	./bin/docker-make --no-push
	docker container prune -f
	docker-compose build

## Pull Docker images
pull:
	docker-compose pull

## Push Docker images using docker-make
push:
	./bin/docker-make

## Install Node Javascript dependencies
yarn:
	./bin/yarn

## Build and start Node
up: build-config yarn build
	docker-compose up -d --build

## Shutdown Node
down:
	docker-compose down

## Tail Node logs
logs:
	docker-compose logs -f -t

## View running processes
ps:
	docker-compose ps

## Shutdown and **destroy** all local Node data
clean: down
	@sudo rm -rf ./.data/*

.PHONY: all build-config build pull push yarn up down logs ps clean
