# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Railway-friendly nginx config is generated at runtime from env vars
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY nginx-ssl.conf.template /etc/nginx/templates/ssl.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.sh

# Install openssl (dev certs) + envsubst (template rendering)
RUN apk add --no-cache openssl gettext

# Create SSL directory for certificates
RUN mkdir -p /etc/nginx/ssl

# Generate self-signed certificate for development (4096-bit RSA, 365 days)
# In production, use Let's Encrypt or your organization's certificates
RUN openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
    -keyout /etc/nginx/ssl/key.pem \
    -out /etc/nginx/ssl/cert.pem \
    -subj "/C=BD/ST=Dhaka/L=Dhaka/O=IUT_Cafeteria/CN=localhost"

# Create certbot directory for Let's Encrypt (production)
RUN mkdir -p /var/www/certbot

EXPOSE 80 443
ENTRYPOINT ["/bin/sh", "/docker-entrypoint.sh"]
