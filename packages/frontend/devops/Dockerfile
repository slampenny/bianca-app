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
RUN yarn install --frozen-lockfile

# Copy source code (ensure binary files are copied correctly)
COPY . .

# Ensure assets directory is properly copied and has correct permissions
RUN chmod -R 644 assets/images/*.png 2>/dev/null || true && \
    find assets/images -name "*.png" -type f -exec chmod 644 {} \;

# Verify critical assets exist and are valid before building
RUN if [ ! -f "assets/images/icon.png" ]; then \
      echo "ERROR: assets/images/icon.png not found!" && \
      find assets/images -name "*.png" | head -10 && \
      exit 1; \
    fi && \
    chmod 644 assets/images/icon.png && \
    echo "=== File verification ===" && \
    file assets/images/icon.png && \
    ls -lh assets/images/icon.png && \
    echo "=== PNG header check ===" && \
    head -c 8 assets/images/icon.png | od -An -tx1 && \
    echo "=== File size ===" && \
    wc -c assets/images/icon.png && \
    echo "=== Testing Node.js read ===" && \
    node -e "const fs = require('fs'); const buf = fs.readFileSync('assets/images/icon.png'); console.log('Read', buf.length, 'bytes'); console.log('First 8 bytes:', Array.from(buf.slice(0, 8)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));" && \
    echo "=== Testing image-size library ===" && \
    node -e "try { const imageSize = require('image-size'); const size = imageSize('assets/images/icon.png'); console.log('image-size result:', size); } catch(e) { console.log('image-size error:', e.message); }" && \
    test -r assets/images/icon.png && \
    echo "✅ icon.png verified and readable"

# Build argument for environment
ARG BUILD_ENV=production

# Build the frontend with the specified environment
RUN if [ "$BUILD_ENV" = "staging" ]; then \
      echo "Building for staging environment..." && \
      echo "Setting EXPO_PUBLIC_ENVIRONMENT=staging..." && \
      export EXPO_PUBLIC_ENVIRONMENT=staging && \
      yarn bundle:web:staging || (echo "❌ Frontend build failed with exit code $?" && exit 1) && \
      echo "Staging build complete"; \
    else \
      echo "Building for production environment..." && \
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