# Multi-stage build for frontend
# Use Amazon ECR Public Gallery to avoid Docker Hub credential issues in WSL2
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

# Install system dependencies for image processing
RUN apk add --no-cache \
    file \
    libpng-dev \
    libjpeg-turbo-dev \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
# Try frozen lockfile first, but allow updates if lockfile is out of sync (common in staging)
RUN yarn install --frozen-lockfile || (echo "Lockfile out of sync, updating..." && yarn install && echo "Lockfile updated")

# Copy source code, excluding node_modules and other build artifacts
COPY --chown=root:root . .

# Ensure assets directory has correct permissions
RUN find assets/images -name "*.png" -type f -exec chmod 644 {} \; 2>/dev/null || true

# Validate only web-required images (mobile images are blocked by metro.config.js for web builds)
# For web builds, we only need: app-icon-web-favicon.png and splash-logo-web.png
RUN echo "Validating web-required images..." && \
    WEB_IMAGES="assets/images/app-icon-web-favicon.png assets/images/splash-logo-web.png" && \
    for img in $WEB_IMAGES; do \
      if [ ! -f "$img" ]; then \
        echo "ERROR: Required web image missing: $img" && \
        exit 1; \
      fi && \
      if [ ! -s "$img" ]; then \
        echo "ERROR: Image file is empty: $img" && \
        exit 1; \
      fi && \
      if ! file "$img" | grep -q "PNG image"; then \
        echo "ERROR: Invalid PNG file: $img" && \
        file "$img" && \
        exit 1; \
      fi && \
      echo "✅ $img validated"; \
    done && \
    echo "✅ Web-required images validated"

# Build arguments
ARG BUILD_ENV=production
ARG BUILD_VERSION=0.00.0001

# Fix broken expo symlink if needed (monorepo symlinks point to workspace root)
# In monorepo, expo CLI symlink might point to workspace root which doesn't exist in Docker
RUN echo "Checking expo CLI..." && \
    if [ -L "node_modules/.bin/expo" ]; then \
      SYMLINK_TARGET=$(readlink node_modules/.bin/expo) && \
      if echo "$SYMLINK_TARGET" | grep -q "^\.\./\.\./\.\./\.\./"; then \
        echo "Fixing broken expo symlink (points to workspace root: $SYMLINK_TARGET)..." && \
        rm -f node_modules/.bin/expo; \
      elif [ ! -e "node_modules/.bin/expo" ]; then \
        echo "Fixing broken expo symlink (target doesn't exist: $SYMLINK_TARGET)..." && \
        rm -f node_modules/.bin/expo; \
      fi; \
    fi && \
    if [ ! -f "node_modules/.bin/expo" ] || [ ! -e "node_modules/.bin/expo" ]; then \
      echo "Expo CLI not in .bin, checking for local installation..." && \
      if [ -f "node_modules/expo/bin/cli" ]; then \
        echo "Found expo/bin/cli, creating symlink..." && \
        mkdir -p node_modules/.bin && \
        ln -sf "../expo/bin/cli" node_modules/.bin/expo && \
        chmod +x node_modules/.bin/expo && \
        echo "✅ Created expo symlink"; \
      elif [ -f "node_modules/expo/bin/cli.js" ]; then \
        echo "Found expo/bin/cli.js, creating symlink..." && \
        mkdir -p node_modules/.bin && \
        ln -sf "../expo/bin/cli.js" node_modules/.bin/expo && \
        chmod +x node_modules/.bin/expo && \
        echo "✅ Created expo symlink"; \
      elif [ -f "node_modules/@expo/cli/build/bin/cli.js" ]; then \
        echo "Found @expo/cli/build/bin/cli.js, creating symlink..." && \
        mkdir -p node_modules/.bin && \
        ln -sf "../@expo/cli/build/bin/cli.js" node_modules/.bin/expo && \
        chmod +x node_modules/.bin/expo && \
        echo "✅ Created expo symlink"; \
      else \
        echo "⚠️  Expo CLI not found, installing @expo/cli..." && \
        yarn add -D @expo/cli && \
        EXPO_CLI_PATH=$(find node_modules/@expo/cli -name "cli.js" -type f 2>/dev/null | head -1) && \
        if [ -n "$EXPO_CLI_PATH" ]; then \
          mkdir -p node_modules/.bin && \
          RELATIVE_PATH=$(echo "$EXPO_CLI_PATH" | sed 's|^node_modules/||') && \
          ln -sf "../$RELATIVE_PATH" node_modules/.bin/expo && \
          chmod +x node_modules/.bin/expo && \
          echo "✅ Installed and linked @expo/cli at $EXPO_CLI_PATH"; \
        else \
          echo "ERROR: @expo/cli installed but cli.js not found" && \
          find node_modules/@expo/cli -type f | head -10 && \
          exit 1; \
        fi; \
      fi; \
    else \
      echo "✅ Expo CLI already available"; \
    fi && \
    echo "Verifying expo CLI..." && \
    (node node_modules/.bin/expo --version 2>/dev/null || echo "WARNING: expo CLI verification failed, but continuing...")

# Build the frontend with the specified environment
RUN if [ "$BUILD_ENV" = "staging" ]; then \
      echo "Building for staging environment..." && \
      echo "Using app.staging.json for staging build..." && \
      cp app.staging.json app.json && \
      echo "Clearing Metro cache..." && \
      rm -rf .expo .metro node_modules/.cache 2>/dev/null || true && \
      echo "Setting EXPO_PUBLIC_ENVIRONMENT=staging..." && \
      echo "Setting EXPO_PUBLIC_BUILD_VERSION=$BUILD_VERSION..." && \
      EXPO_PUBLIC_ENVIRONMENT=staging EXPO_PUBLIC_BUILD_VERSION=$BUILD_VERSION node node_modules/.bin/expo export --platform web || (echo "❌ Frontend build failed with exit code $?" && exit 1) && \
      echo "Staging build complete with version $BUILD_VERSION"; \
    else \
      echo "Building for production environment..." && \
      echo "Setting EXPO_PUBLIC_BUILD_VERSION=$BUILD_VERSION..." && \
      export EXPO_PUBLIC_BUILD_VERSION=$BUILD_VERSION && \
      rm -rf .expo .metro node_modules/.cache 2>/dev/null || true && \
      EXPO_PUBLIC_BUILD_VERSION=$BUILD_VERSION node node_modules/.bin/expo export --platform web || (echo "❌ Frontend build failed with exit code $?" && exit 1) && \
      echo "Production build complete with version $BUILD_VERSION"; \
    fi

# Production stage
# Use Amazon ECR Public Gallery to avoid Docker Hub credential issues in WSL2
FROM public.ecr.aws/docker/library/nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend from builder stage
COPY --from=builder /app/dist/ /usr/share/nginx/html

# Verify the JS file referenced by index.html exists (prevents "Unexpected token '<'" when file is missing)
RUN SCRIPT_SRC=$(grep -oE 'src="[^"]+\.js"' /usr/share/nginx/html/index.html | head -1 | sed 's/src="//;s/"$//') && \
    FILE_PATH="${SCRIPT_SRC#/}" && \
    if [ ! -f "/usr/share/nginx/html/$FILE_PATH" ]; then \
      echo "ERROR: index.html references $SCRIPT_SRC but file is missing at /usr/share/nginx/html/$FILE_PATH"; \
      echo "This causes 'Unexpected token <' in browser (nginx serves HTML 404 for missing .js)"; \
      exit 1; \
    fi && \
    echo "Verified JS asset exists: $FILE_PATH"

# Custom nginx config for SPA routing
COPY devops/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 