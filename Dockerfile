FROM quay.io/chainpoint/node-base:master

COPY package.json package-lock.json /home/node/app/
RUN /usr/local/bin/npm install --no-optional

RUN mkdir /home/node/app/endpoints
COPY ./endpoints/*.js /home/node/app/endpoints/

COPY server.js /home/node/app/

CMD ["npm", "start"]
