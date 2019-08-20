# Node.js 8.x LTS on Debian Stretch Linux
# see: https://github.com/nodejs/LTS
# see: https://hub.docker.com/_/node/
FROM node:12.4.0-stretch

LABEL MAINTAINER="Jacob Henderson <jacob@tierion.com>"

# gosu : https://github.com/tianon/gosu
RUN apt-get update && apt-get install -y git gosu

# The `node` user and its home dir is provided by
# the base image. Create a subdir where app code lives.
RUN mkdir /home/node/app

WORKDIR /home/node/app

COPY package.json yarn.lock server.js /home/node/app/
RUN yarn

RUN mkdir -p /home/node/app/lib
COPY ./lib/*.js /home/node/app/lib/

RUN mkdir -p /home/node/app/lib/endpoints
COPY ./lib/endpoints/*.js /home/node/app/lib/endpoints/

RUN mkdir -p /home/node/app/lib/models
COPY ./lib/models/*.js /home/node/app/lib/models/

RUN mkdir -p /home/node/app/artifacts
COPY artifacts /home/node/app/artifacts

#COPY ./cert.crt /home/node/app/
#COPY ./cert.key /home/node/app/

RUN mkdir -p /home/node/app/cli
COPY cli /home/node/app/cli

EXPOSE 80

CMD ["/bin/bash", "-c", "/home/node/app/cli/run.sh"]
