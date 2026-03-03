#!/bin/sh
set -eu

# Railway sets PORT dynamically. Default to 80 for Docker/local.
# All variables MUST be exported so envsubst child process inherits them.
export PORT="${PORT:-80}"
export ENABLE_HTTPS="${ENABLE_HTTPS:-false}"
export SSL_CERT_PATH="${SSL_CERT_PATH:-/etc/nginx/ssl/cert.pem}"
export SSL_KEY_PATH="${SSL_KEY_PATH:-/etc/nginx/ssl/key.pem}"

# Default upstreams work for Docker Compose service DNS.
export IDENTITY_PROVIDER_UPSTREAM="${IDENTITY_PROVIDER_UPSTREAM:-http://identity-provider:3001}"
export ORDER_GATEWAY_UPSTREAM="${ORDER_GATEWAY_UPSTREAM:-http://order-gateway:3000}"
export STOCK_SERVICE_UPSTREAM="${STOCK_SERVICE_UPSTREAM:-http://stock-service:3002}"
export KITCHEN_QUEUE_UPSTREAM="${KITCHEN_QUEUE_UPSTREAM:-http://kitchen-queue:3003}"
export NOTIFICATION_HUB_UPSTREAM="${NOTIFICATION_HUB_UPSTREAM:-http://notification-hub:3004}"

# Choose template based on HTTPS mode
if [ "$ENABLE_HTTPS" = "true" ] && [ -f "$SSL_CERT_PATH" ] && [ -f "$SSL_KEY_PATH" ]; then
  echo "[entrypoint] HTTPS mode enabled — using SSL config"
  TEMPLATE=/etc/nginx/templates/ssl.conf.template
else
  echo "[entrypoint] HTTP mode — HTTPS disabled or certs not found"
  TEMPLATE=/etc/nginx/templates/default.conf.template
fi

# Render nginx config from template.
envsubst '$PORT $IDENTITY_PROVIDER_UPSTREAM $ORDER_GATEWAY_UPSTREAM $STOCK_SERVICE_UPSTREAM $KITCHEN_QUEUE_UPSTREAM $NOTIFICATION_HUB_UPSTREAM $SSL_CERT_PATH $SSL_KEY_PATH' \
  < "$TEMPLATE" \
  > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
