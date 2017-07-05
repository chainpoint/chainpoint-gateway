FROM quay.io/chainpoint/node-base:master

COPY package.json package-lock.json /home/node/app/
RUN /usr/local/bin/npm install --no-optional

RUN mkdir /home/node/app/lib
COPY ./lib/*.js /home/node/app/lib/
RUN mkdir /home/node/app/lib/endpoints
COPY ./lib/endpoints/*.js /home/node/app/lib/endpoints/
RUN mkdir /home/node/app/lib/models
COPY ./lib/models/*.js /home/node/app/lib/models/

COPY server.js /home/node/app/

CMD ["npm", "start"]
