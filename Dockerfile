# Node.js 8.x LTS on Debian Stretch Linux
# see: https://github.com/nodejs/LTS
# see: https://hub.docker.com/_/node/
FROM node:10.14.2-stretch

LABEL MAINTAINER="Glenn Rempe <glenn@tierion.com>"

# gosu : https://github.com/tianon/gosu
RUN apt-get update && apt-get install -y git gosu

# Tini : https://github.com/krallin/tini
ENV TINI_VERSION v0.18.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
#ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini.asc /tini.asc
#RUN gpg --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys 595E85A6B1B4779EA4DAAEC70B588DFF0527A9B7 && gpg --verify /tini.asc
RUN chown root:root /tini && chmod 755 /tini

# The `node` user and its home dir is provided by
# the base image. Create a subdir where app code lives.
RUN mkdir /home/node/app
RUN mkdir /home/node/app/ui

# Copy Build Artifacts Node Stats UI
COPY ./ui/build /home/node/app/ui

WORKDIR /home/node/app

ENV NODE_ENV production

COPY package.json yarn.lock auth-keys-print.js server.js /home/node/app/
RUN yarn

RUN mkdir -p /home/node/app/lib
COPY ./lib/*.js /home/node/app/lib/

RUN mkdir -p /home/node/app/lib/endpoints
COPY ./lib/endpoints/*.js /home/node/app/lib/endpoints/

RUN mkdir -p /home/node/app/lib/models
COPY ./lib/models/*.js /home/node/app/lib/models/

COPY ./tor-exit-nodes.txt /home/node/app/

COPY ./cert.crt /home/node/app/
COPY ./cert.key /home/node/app/

RUN mkdir -p /home/node/app/keys
RUN mkdir -p /home/node/app/keys/backups
RUN mkdir -p /home/node/app/rocksdb

EXPOSE 8080 8443

ENTRYPOINT ["gosu", "node:node", "/tini", "--"]

CMD ["yarn", "start"]
