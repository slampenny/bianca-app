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

# Build argument for environment
ARG BUILD_ENV=production

# Fix broken expo symlink if needed (monorepo symlinks point to workspace root)
RUN echo "Checking expo CLI..." && \
    if [ -L "node_modules/.bin/expo" ] && [ ! -e "node_modules/.bin/expo" ]; then \
      echo "Fixing broken expo symlink..." && \
      rm -f node_modules/.bin/expo; \
    fi && \
    if [ ! -f "node_modules/.bin/expo" ] || [ ! -e "node_modules/.bin/expo" ]; then \
      if [ -f "node_modules/expo/bin/cli.js" ]; then \
        echo "Creating expo symlink to expo/bin/cli.js" && \
        ln -sf "../expo/bin/cli.js" node_modules/.bin/expo; \
      elif [ -f "node_modules/@expo/cli/build/bin/cli.js" ]; then \
        echo "Creating expo symlink to @expo/cli" && \
        ln -sf "../@expo/cli/build/bin/cli.js" node_modules/.bin/expo; \
      else \
        echo "ERROR: Could not find expo CLI!" && \
        find node_modules -name "cli.js" -path "*expo*" 2>&1 | head -5 && \
        exit 1; \
      fi && \
      chmod +x node_modules/.bin/expo 2>/dev/null || true; \
    fi && \
    ls -la node_modules/.bin/expo && \
    echo "✅ Expo CLI ready"

# Build the frontend with the specified environment
RUN if [ "$BUILD_ENV" = "staging" ]; then \
      echo "Building for staging environment..." && \
      echo "Using app.staging.json for staging build..." && \
      cp app.staging.json app.json && \
      echo "Clearing Metro cache..." && \
      rm -rf .expo .metro node_modules/.cache 2>/dev/null || true && \
      echo "Setting EXPO_PUBLIC_ENVIRONMENT=staging..." && \
      export EXPO_PUBLIC_ENVIRONMENT=staging && \
      EXPO_PUBLIC_ENVIRONMENT=staging yarn bundle:web:staging || (echo "❌ Frontend build failed with exit code $?" && exit 1) && \
      echo "Staging build complete"; \
    else \
      echo "Building for production environment..." && \
      rm -rf .expo .metro node_modules/.cache 2>/dev/null || true && \
      yarn bundle:web || (echo "❌ Frontend build failed with exit code $?" && exit 1) && \
      echo "Production build complete"; \
    fi

# Production stage
# Use Amazon ECR Public Gallery to avoid Docker Hub credential issues in WSL2
FROM public.ecr.aws/docker/library/nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built frontend from builder stage
COPY --from=builder /app/dist/ /usr/share/nginx/html

# Custom nginx config for SPA routing
COPY devops/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 