FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy Expo web build to nginx public directory
COPY dist/ /usr/share/nginx/html

# Custom nginx config for SPA routing
COPY devops/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 