FROM public.ecr.aws/docker/library/node:18-buster

# Create app directory
RUN mkdir -p /usr/src/bianca-app && chown -R node:node /usr/src/bianca-app
WORKDIR /usr/src/bianca-app

RUN apt-get update && apt-get install -y \
  libssl-dev \
  ca-certificates \
  curl \
  tcpdump \
  iputils-ping \
  net-tools \
  awscli \
  # --- End added tools ---
  # Clean up apt cache
  && rm -rf /var/lib/apt/lists/*

# Pre-download MongoDB binary
RUN curl -o mongodb.tgz https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian10-6.0.9.tgz && \
tar -xvf mongodb.tgz && \
mv mongodb-linux-x86_64-debian10-6.0.9/bin/* /usr/local/bin/ && \
rm -rf mongodb-linux-x86_64-debian10-6.0.9 mongodb.tgz

# Make MongoDB binary executable and check version
RUN chmod +x /usr/local/bin/mongod && /usr/local/bin/mongod --version

# Set environment variable for MongoMemoryServer
ENV MONGOMS_SYSTEM_BINARY /usr/local/bin/mongod

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