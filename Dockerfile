FROM quay.io/chainpoint/node-base:master

COPY package.json yarn.lock server.js /home/node/app/
RUN yarn --verbose

RUN mkdir -p /home/node/app/lib
COPY ./lib/*.js /home/node/app/lib/

RUN mkdir -p /home/node/app/lib/endpoints
COPY ./lib/endpoints/*.js /home/node/app/lib/endpoints/

RUN mkdir -p /home/node/app/lib/models
COPY ./lib/models/*.js /home/node/app/lib/models/

EXPOSE 8080

CMD ["yarn", "start"]
