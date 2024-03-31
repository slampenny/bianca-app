FROM node:alpine

# Create app directoryaaaas
RUN mkdir -p /usr/src/bianca-app && chown -R node:node /usr/src/bianca-app
WORKDIR /usr/src/bianca-app

# Install app dependencies
COPY package.json yarn.lock ./
USER node
RUN yarn install --pure-lockfile

# Bundle app source
COPY --chown=node:node . .

# Expose the port the app runs on
EXPOSE 3000

# Command to run your application
CMD ["yarn", "start"]
