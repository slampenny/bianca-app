# Multi-stage build for better caching and smaller final image
# syntax=docker/dockerfile:1.4
# Use Amazon ECR Public Gallery to avoid Docker Hub credential issues in WSL2
FROM public.ecr.aws/docker/library/node:18-bullseye AS base

# Create app directory
RUN mkdir -p /usr/src/bianca-app && chown -R node:node /usr/src/bianca-app
WORKDIR /usr/src/bianca-app

# Install system dependencies in a single layer
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

# Pre-download MongoDB binary
RUN curl -o mongodb.tgz https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian11-6.0.9.tgz && \
    tar -xvf mongodb.tgz && \
    mv mongodb-linux-x86_64-debian11-6.0.9/bin/* /usr/local/bin/ && \
    chmod +x /usr/local/bin/mongod && \
    /usr/local/bin/mongod --version && \
    rm -rf mongodb-linux-x86_64-debian11-6.0.9 mongodb.tgz

# Set environment variable for MongoMemoryServer
ENV MONGOMS_SYSTEM_BINARY=/usr/local/bin/mongod

# Dependencies stage - this layer will be cached unless package.json changes
FROM base AS dependencies
COPY --chown=node:node package.json yarn.lock ./
USER node
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --pure-lockfile --frozen-lockfile

# Build stage - copy source and build if needed
FROM dependencies AS build
# Copy static config files (rarely change)
COPY --chown=node:node .env* .eslintrc.json .prettierrc.json jest.config.js nodemon.json .editorconfig .eslintignore .gitattributes .lintstagedrc.json .prettierignore .nvmrc LICENSE ecosystem.config.json docker-compose*.yml ./

# Copy source code
COPY --chown=node:node src/ ./src/
COPY --chown=node:node tests/ ./tests/
# Note: devops/ directory not needed in container - used only for infrastructure deployment

# Production stage - minimal final image
FROM base AS production
# Copy dependencies from build stage
COPY --from=dependencies --chown=node:node /usr/src/bianca-app/node_modules ./node_modules
# Copy built application
COPY --from=build --chown=node:node /usr/src/bianca-app ./

USER node

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Command to run your application
CMD ["yarn", "start"]