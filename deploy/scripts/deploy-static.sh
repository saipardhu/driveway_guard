#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <user@server>"
  echo "Example: $0 ubuntu@203.0.113.10"
  exit 1
fi

REMOTE="$1"
REMOTE_APP_ROOT="/var/www/driveway_guard"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

echo "[1/4] Preparing release bundle..."
mkdir -p "$TMP_DIR/assets"
cp -r ./assets "$TMP_DIR/"
cp ./index.html "$TMP_DIR/"

if [[ -f ./README.md ]]; then
  cp ./README.md "$TMP_DIR/"
fi

echo "[2/4] Uploading files to $REMOTE:$REMOTE_APP_ROOT ..."
rsync -avz --delete "$TMP_DIR"/ "$REMOTE:$REMOTE_APP_ROOT/"

echo "[3/4] Fixing file permissions..."
ssh "$REMOTE" "sudo chown -R www-data:www-data '$REMOTE_APP_ROOT'"

echo "[4/4] Deploy complete."
echo "Smoke test:"
echo "  - Open your site URL and confirm auth prompt appears."
echo "  - Log in and verify app loads with current assets."
