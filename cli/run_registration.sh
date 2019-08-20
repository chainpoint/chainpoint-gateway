#!/bin/bash
cd $(dirname $0)

get_container_count () {
  docker info --format='{{json .ContainersRunning}}'
}

echo $foobar

until [ "`docker info --format='{{json .ContainersRunning}}'`" -gt "0" ]; do
  sleep 0.5;
done

docker exec -ti `docker ps -q` bash -c "source cli/scripts/env_secrets_expand.sh && node cli/register.js NODE_ETH_REWARDS_ADDRESS=${NODE_ETH_REWARDS_ADDRESS} NODE_PUBLIC_IP_ADDRESS=${NODE_PUBLIC_IP_ADDRESS}"

docker stack rm chainpoint-registration
