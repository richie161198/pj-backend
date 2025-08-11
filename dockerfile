FROM node:20

WORKDIR /pg-client

COPY package*.json ./

RUN npm install

COPY . /pg-client/

ENV PORT=9000

CMD [ "npm", "start" ]

