# Node.js LTS on Alpine Linux
# see: https://github.com/nodejs/LTS
# see: https://hub.docker.com/_/node/
# see: https://alpinelinux.org/
FROM node:8.9.0-alpine

LABEL MAINTAINER="Glenn Rempe <glenn@tierion.com>"

RUN apk update && \
    apk upgrade && \
    rm -rf /var/cache/apk/*

RUN apk add --update git tini su-exec --no-cache

# Needed to load native node modules
# See : https://github.com/grpc/grpc/issues/8528
RUN apk add libc6-compat --no-cache

# The `node` user and its home dir is provided by
# the base image. Create a subdir where app code lives.
RUN mkdir /home/node/app
RUN mkdir /home/node/app/ui

# Copy Build Artifacts Node Stats UI
COPY ./ui/build /home/node/app/ui

RUN ls -la /home/node/app/ui

WORKDIR /home/node/app

ENV NODE_ENV production

COPY package.json yarn.lock server.js /home/node/app/
RUN yarn

RUN mkdir -p /home/node/app/lib
COPY ./lib/*.js /home/node/app/lib/

RUN mkdir -p /home/node/app/lib/endpoints
COPY ./lib/endpoints/*.js /home/node/app/lib/endpoints/

RUN mkdir -p /home/node/app/lib/models
COPY ./lib/models/*.js /home/node/app/lib/models/

COPY ./tor-exit-nodes.txt /home/node/app/

EXPOSE 8080

ENTRYPOINT ["su-exec", "node:node", "/sbin/tini", "--"]

CMD ["yarn", "start"]
