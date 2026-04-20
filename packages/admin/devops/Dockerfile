# Multi-stage build: Vite static app + nginx (monorepo build context = repo root)
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
COPY packages/shared ./packages/shared
COPY packages/admin ./packages/admin

RUN yarn install --frozen-lockfile || (echo "Lockfile out of sync, updating..." && yarn install && echo "Lockfile updated")

ARG BUILD_ENV=production
ARG VITE_API_URL=
ARG VITE_GRAFANA_URL=
# Facility (caregiver) web app — used for super-admin "Open as user" (postMessage handoff). Must match public site origin.
ARG VITE_FACILITY_APP_URL=

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GRAFANA_URL=$VITE_GRAFANA_URL
ENV VITE_FACILITY_APP_URL=$VITE_FACILITY_APP_URL

WORKDIR /app/packages/admin
RUN echo "Building admin (BUILD_ENV=$BUILD_ENV, VITE_API_URL=${VITE_API_URL:-<unset>})..." && \
    yarn build || (echo "❌ Vite build failed" && exit 1)

FROM public.ecr.aws/docker/library/nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/packages/admin/dist/ /usr/share/nginx/html

RUN SCRIPT_SRC=$(grep -oE 'src="[^"]+\.js"' /usr/share/nginx/html/index.html | head -1 | sed 's/src="//;s/"$//') && \
    FILE_PATH="${SCRIPT_SRC#/}" && \
    if [ ! -f "/usr/share/nginx/html/$FILE_PATH" ]; then \
      echo "ERROR: index.html references $SCRIPT_SRC but file is missing at /usr/share/nginx/html/$FILE_PATH"; \
      exit 1; \
    fi && \
    echo "Verified JS asset exists: $FILE_PATH" && \
    DIR="/usr/share/nginx/html/$(dirname "$FILE_PATH")" && \
    BASE="$(basename "$FILE_PATH")" && \
    ln -sf "$BASE" "$DIR/index-current.js" && \
    echo "Created index-current.js -> $BASE"

COPY packages/admin/devops/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
