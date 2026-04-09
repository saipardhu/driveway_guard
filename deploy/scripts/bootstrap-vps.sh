#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <domain> <email-for-lets-encrypt>"
  echo "Example: $0 drivewayguard.example.com admin@example.com"
  exit 1
fi

DOMAIN="$1"
LETSENCRYPT_EMAIL="$2"
APP_ROOT="/var/www/driveway_guard"
NGINX_SITE_AVAILABLE="/etc/nginx/sites-available/driveway_guard.conf"
NGINX_SITE_ENABLED="/etc/nginx/sites-enabled/driveway_guard.conf"
REPO_NGINX_CONF_TEMPLATE="./deploy/nginx/driveway_guard.conf"

if [[ ! -f "$REPO_NGINX_CONF_TEMPLATE" ]]; then
  echo "Cannot find $REPO_NGINX_CONF_TEMPLATE from current directory."
  echo "Run this script from the repository root."
  exit 1
fi

echo "[1/8] Installing packages..."
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx apache2-utils rsync

echo "[2/8] Creating app directory..."
sudo mkdir -p "$APP_ROOT"
sudo chown -R "$USER":"$USER" "$APP_ROOT"

echo "[3/8] Creating temporary nginx config for HTTP..."
TMP_CONF="$(mktemp)"
sed "s/your-domain.com/$DOMAIN/g" "$REPO_NGINX_CONF_TEMPLATE" > "$TMP_CONF"
# Remove TLS-only server block before first cert issuance.
awk '
  BEGIN { keep=1; seen=0; depth=0 }
  /^server \{/ {
    seen++;
    if (seen == 2) { keep=0; depth=1; next }
  }
  {
    if (keep == 1) print $0;
    if (seen >= 2 && keep == 0) {
      if ($0 ~ /\{/) depth++;
      if ($0 ~ /\}/) depth--;
      if (depth == 0) keep=2;
      next;
    }
  }
' "$TMP_CONF" | sudo tee "$NGINX_SITE_AVAILABLE" > /dev/null

echo "[4/8] Enabling nginx site..."
sudo ln -sf "$NGINX_SITE_AVAILABLE" "$NGINX_SITE_ENABLED"
sudo nginx -t
sudo systemctl reload nginx

echo "[5/8] Requesting TLS certificate..."
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$LETSENCRYPT_EMAIL" --redirect

echo "[6/8] Writing final nginx config with TLS..."
sed "s/your-domain.com/$DOMAIN/g" "$REPO_NGINX_CONF_TEMPLATE" | sudo tee "$NGINX_SITE_AVAILABLE" > /dev/null

echo "[7/8] Reloading nginx..."
sudo nginx -t
sudo systemctl reload nginx

echo "[8/8] Verifying cert auto-renew..."
sudo certbot renew --dry-run

echo "Bootstrap complete."
echo "Next:"
echo "  1) Upload site files to $APP_ROOT (see deploy/scripts/deploy-static.sh)."
echo "  2) Create Basic Auth user:"
echo "     sudo htpasswd -c /etc/nginx/.htpasswd-driveway-guard <username>"
echo "  3) Test: https://$DOMAIN"
