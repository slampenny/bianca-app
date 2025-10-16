# Multi-stage build for frontend
# Use Amazon ECR Public Gallery to avoid Docker Hub credential issues in WSL2
FROM public.ecr.aws/docker/library/node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build argument for environment
ARG BUILD_ENV=production

# Build the frontend with the specified environment
RUN if [ "$BUILD_ENV" = "staging" ]; then \
      echo "Building for staging environment..." && \
      echo "Setting EXPO_PUBLIC_ENVIRONMENT=staging..." && \
      export EXPO_PUBLIC_ENVIRONMENT=staging && \
      yarn bundle:web:staging && \
      echo "Staging build complete"; \
    else \
      echo "Building for production environment..." && \
      yarn bundle:web && \
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