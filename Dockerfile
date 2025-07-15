FROM public.ecr.aws/docker/library/node:18-bullseye

# Create app directory
RUN mkdir -p /usr/src/bianca-app && chown -R node:node /usr/src/bianca-app
WORKDIR /usr/src/bianca-app

# Install system dependencies in a single layer to reduce image size
RUN apt-get update && apt-get install -y \
  libssl-dev \
  ca-certificates \
  curl \
  tcpdump \
  iputils-ping \
  net-tools \
  awscli \
  ffmpeg \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

# Pre-download MongoDB binary and make executable in a single layer
RUN curl -o mongodb.tgz https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian11-6.0.9.tgz && \
    tar -xvf mongodb.tgz && \
    mv mongodb-linux-x86_64-debian11-6.0.9/bin/* /usr/local/bin/ && \
    chmod +x /usr/local/bin/mongod && \
    /usr/local/bin/mongod --version && \
    rm -rf mongodb-linux-x86_64-debian11-6.0.9 mongodb.tgz

# Set environment variable for MongoMemoryServer
ENV MONGOMS_SYSTEM_BINARY /usr/local/bin/mongod

# Install app dependencies
COPY package.json yarn.lock ./
USER node
RUN yarn install --pure-lockfile

# Copy source code (this should be after dependencies to maximize caching)
COPY --chown=node:node src/ ./src/
COPY --chown=node:node devops/ ./devops/
COPY --chown=node:node .env* ./
COPY --chown=node:node .eslintrc.json ./
COPY --chown=node:node .prettierrc.json ./
COPY --chown=node:node jest.config.js ./
COPY --chown=node:node nodemon.json ./
COPY --chown=node:node README.md ./
COPY --chown=node:node .editorconfig ./
COPY --chown=node:node .eslintignore ./
COPY --chown=node:node .gitattributes ./
COPY --chown=node:node .lintstagedrc.json ./
COPY --chown=node:node .prettierignore ./
COPY --chown=node:node .nvmrc ./
COPY --chown=node:node LICENSE ./
COPY --chown=node:node ecosystem.config.json ./
COPY --chown=node:node docker-compose*.yml ./
COPY --chown=node:node .travis.yml ./

# Expose the port the app runs on
EXPOSE 3000

# Command to run your application
CMD ["yarn", "start"]