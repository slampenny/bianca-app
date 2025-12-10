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

# Copy source code
# Note: Docker COPY preserves binary files, but we'll verify and fix if needed
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
    echo "=== Fixing PNG header if corrupted ===" && \
    node -e "const fs = require('fs'); const buf = fs.readFileSync('assets/images/icon.png'); const header = Array.from(buf.slice(0, 8)); const expected = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]; let needsFix = false; for (let i = 0; i < 8; i++) { if (header[i] !== expected[i]) { needsFix = true; break; } } if (needsFix) { console.log('PNG header corrupted, fixing...'); for (let i = 0; i < 8; i++) { buf[i] = expected[i]; } fs.writeFileSync('assets/images/icon.png', buf); console.log('Header fixed'); } else { console.log('Header is valid'); }" && \
    echo "✅ icon.png file exists (will be validated by Metro during build)"

# Build argument for environment
ARG BUILD_ENV=production

# Build the frontend with the specified environment
RUN if [ "$BUILD_ENV" = "staging" ]; then \
      echo "Building for staging environment..." && \
      echo "Setting EXPO_PUBLIC_ENVIRONMENT=staging..." && \
      export EXPO_PUBLIC_ENVIRONMENT=staging && \
      echo "=== Pre-build file check ===" && \
      ls -la assets/images/icon.png && \
      yarn bundle:web:staging || (echo "❌ Frontend build failed with exit code $?" && exit 1) && \
      echo "Staging build complete"; \
    else \
      echo "Building for production environment..." && \
      echo "=== Pre-build file check ===" && \
      ls -la assets/images/icon.png && \
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