# Multi-stage build for better caching and smaller final image
# Build context: monorepo root (see buildspec-staging.yml / buildspec-production.yml)
# syntax=docker/dockerfile:1.4
FROM public.ecr.aws/docker/library/node:20-bullseye AS base

RUN mkdir -p /app && chown -R node:node /app
RUN mkdir -p /home/node/.yarn && chown -R node:node /home/node
WORKDIR /app

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

RUN curl -o mongodb.tgz https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian11-6.0.9.tgz && \
    tar -xvf mongodb.tgz && \
    mv mongodb-linux-x86_64-debian11-6.0.9/bin/* /usr/local/bin/ && \
    chmod +x /usr/local/bin/mongod && \
    /usr/local/bin/mongod --version && \
    rm -rf mongodb-linux-x86_64-debian11-6.0.9 mongodb.tgz

ENV MONGOMS_SYSTEM_BINARY=/usr/local/bin/mongod

RUN corepack enable

FROM base AS dependencies
COPY --chown=node:node package.json yarn.lock .yarnrc.yml ./
COPY --chown=node:node .yarn ./.yarn
COPY --chown=node:node packages/backend/package.json ./packages/backend/package.json
USER node
RUN yarn workspaces focus @bianca-app/backend --production

FROM dependencies AS build
ARG BUILD_TIMESTAMP
ARG GIT_COMMIT
USER root
RUN echo "Build timestamp: ${BUILD_TIMESTAMP:-unknown}, Git commit: ${GIT_COMMIT:-unknown}"
COPY --chown=node:node packages/backend/.eslintrc.json packages/backend/.prettierrc.json packages/backend/jest.config.js packages/backend/nodemon.json packages/backend/.editorconfig packages/backend/.eslintignore packages/backend/.gitattributes packages/backend/.lintstagedrc.json packages/backend/.prettierignore packages/backend/.nvmrc packages/backend/LICENSE packages/backend/ecosystem.config.json ./packages/backend/
COPY --chown=node:node packages/backend/src ./packages/backend/src/
COPY --chown=node:node packages/backend/tests/fixtures/*.fixture.js ./packages/backend/tests/fixtures/
COPY --chown=node:node packages/backend/migrations ./packages/backend/migrations/
COPY --chown=node:node packages/backend/migrate-mongo-config.js ./packages/backend/

FROM base AS production
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/backend ./packages/backend
WORKDIR /app/packages/backend
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["yarn", "start"]
