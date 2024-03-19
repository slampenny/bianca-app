FROM node:alpine

RUN mkdir -p /usr/src/bianca-app && chown -R node:node /usr/src/bianca-app

WORKDIR /usr/src/bianca-app

COPY package.json yarn.lock ./

USER node

RUN yarn install --pure-lockfile

COPY --chown=node:node . .

EXPOSE 3000
