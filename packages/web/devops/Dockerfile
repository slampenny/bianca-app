# Facility web static app + nginx. Super-admin uses packages/admin/devops/Dockerfile (separate container, same EC2).
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY packages/shared ./packages/shared
COPY packages/ui ./packages/ui
COPY packages/web ./packages/web

RUN yarn install --immutable || (echo "Lockfile out of sync, updating..." && yarn install && echo "Lockfile updated")

ARG BUILD_ENV=production
ARG VITE_API_URL=
ARG VITE_ADMIN_APP_ORIGIN=
ARG VITE_MOBILE_APP_URL=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_ADMIN_APP_ORIGIN=$VITE_ADMIN_APP_ORIGIN
ENV VITE_MOBILE_APP_URL=$VITE_MOBILE_APP_URL

WORKDIR /app/packages/web
RUN echo "Building web (BUILD_ENV=$BUILD_ENV, VITE_API_URL=${VITE_API_URL:-<unset>})..." && \
    yarn build || (echo "Vite web build failed" && exit 1)

FROM public.ecr.aws/docker/library/nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/packages/web/dist/ /usr/share/nginx/html

RUN SCRIPT_SRC=$(grep -oE 'src="[^"]+\.js"' /usr/share/nginx/html/index.html | head -1 | sed 's/src="//;s/"$//') && \
    FILE_PATH="${SCRIPT_SRC#/}" && \
    if [ ! -f "/usr/share/nginx/html/$FILE_PATH" ]; then \
      echo "ERROR: index.html references $SCRIPT_SRC but file missing"; exit 1; \
    fi && \
    DIR="/usr/share/nginx/html/$(dirname "$FILE_PATH")" && \
    BASE="$(basename "$FILE_PATH")" && \
    ln -sf "$BASE" "$DIR/index-current.js" && \
    echo "index-current.js -> $BASE"

COPY packages/web/devops/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
