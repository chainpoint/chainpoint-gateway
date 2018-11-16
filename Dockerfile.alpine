FROM node:10.13.0-alpine

LABEL MAINTAINER="Glenn Rempe <glenn@tierion.com>"
WORKDIR /home/node/app
ENV NODE_ENV production

# Copy package.json first, build and then add other files.
# This way there's no need to rebuild the whole thing if only a few JS files change
COPY package.json yarn.lock ./

# Install dependencies and create directories
RUN apk add --no-cache su-exec tini && \
  apk add --no-cache --virtual .build build-base linux-headers git python && \
  mkdir -p keys/backups && \
  mkdir -p rocksdb && \
  JOBS=max npm install --production && \
  \
  # Clean rocksdb build dependencies
  mv node_modules/rocksdb/build/Release/leveldown.node /tmp/ && \
  rm -r node_modules/rocksdb/build/ && \
  mkdir -p node_modules/rocksdb/build/Release/ && \
  mv /tmp/leveldown.node node_modules/rocksdb/build/Release/ && \
  rm -r node_modules/rocksdb/deps && \
  \
  # Remove Alpine build dependencies
  apk del --no-cache .build

# Copy all necessary JS files
COPY auth-keys-print.js server.js tor-exit-nodes.txt cert.crt cert.key ./
COPY lib ./lib
COPY ui/build ./ui

EXPOSE 8080 8443
ENTRYPOINT ["su-exec", "node:node", "tini", "--"]
CMD ["yarn", "start"]
