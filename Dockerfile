# Node.js 8.x LTS on Debian Stretch Linux
# see: https://github.com/nodejs/LTS
# see: https://hub.docker.com/_/node/
FROM node:8.11.3-stretch

LABEL MAINTAINER="Glenn Rempe <glenn@tierion.com>"
WORKDIR /home/node/app
ENV NODE_ENV production

# gosu : https://github.com/tianon/gosu
# The `node` user and its home dir is provided by
# the base image. Create a subdir where app code lives.
RUN apt-get update && \
  apt-get install -y git gosu && \
  mkdir -p /home/node/app/ui && \
  mkdir -p /home/node/app/lib/{endpoints,models} && \
  mkdir -p /home/node/app/keys/backups && \
  mkdir -p /home/node/app/rocksdb

# Copy Build Artifacts Node Stats UI
COPY ./ui/build /home/node/app/ui
COPY package.json yarn.lock auth-keys-print.js server.js /home/node/app/
COPY ./lib/*.js /home/node/app/lib/
COPY ./lib/endpoints/*.js /home/node/app/lib/endpoints/
COPY ./lib/models/*.js /home/node/app/lib/models/
COPY ./tor-exit-nodes.txt /home/node/app/
COPY ./cert.crt /home/node/app/
COPY ./cert.key /home/node/app/

RUN yarn install --production && \
  apt-get remove -y git && \
  apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*

EXPOSE 8080 8443
ENTRYPOINT ["gosu", "node:node"]
CMD ["yarn", "start"]
