#!/usr/bin/env bash
# Deploy blog seed tooling + theme templates, then import scheduled posts into WordPress DB.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
THEME_SRC="$(cd "$SCRIPT_DIR/../wordpress/wp-content/themes/bianca-wellness" && pwd)"
REMOTE="bitnami@3.21.20.225"
KEY="${HOME}/.ssh/bianca-key-pair.pem"
REMOTE_THEME="/bitnami/wordpress/wp-content/themes/bianca-wellness"
REMOTE_SEED_DIR="/tmp/bianca-blog-seed"
NATHAN_ENV="${NATHAN_ENV:-${HOME}/code/nathan-wp/.env}"
TAR="/tmp/bianca-blog-deploy-$$.tar.gz"

if [[ ! -f "$KEY" ]]; then
  echo "SSH key not found: $KEY" >&2
  exit 1
fi

if [[ ! -f "$NATHAN_ENV" ]]; then
  echo "Unsplash env not found: $NATHAN_ENV" >&2
  exit 1
fi

UNSPLASH_KEY="$(grep '^UNSPLASH_ACCESS_KEY=' "$NATHAN_ENV" | cut -d= -f2- | tr -d '\r\"' )"
if [[ -z "$UNSPLASH_KEY" ]]; then
  echo "UNSPLASH_ACCESS_KEY missing in $NATHAN_ENV" >&2
  exit 1
fi

echo "Packaging theme blog templates..."
tar czf "$TAR" -C "$THEME_SRC" single.php index.php assets/css/main.css

echo "Uploading to $REMOTE..."
scp -i "$KEY" -o StrictHostKeyChecking=no "$TAR" "$REMOTE:/tmp/bianca-blog-deploy.tar.gz"
scp -i "$KEY" -o StrictHostKeyChecking=no \
  "$SCRIPT_DIR/seed-blog-posts.php" \
  "$SCRIPT_DIR/blog-posts-seed.json" \
  "$REMOTE:/tmp/"

ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE" \
  "sudo tar xzf /tmp/bianca-blog-deploy.tar.gz -C $REMOTE_THEME && rm /tmp/bianca-blog-deploy.tar.gz"

echo "Seeding scheduled posts into WordPress DB (Unsplash images, ~3–5 min)..."
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE" \
  "UNSPLASH_ACCESS_KEY='$UNSPLASH_KEY' sudo -E /opt/bitnami/wp-cli/bin/wp eval-file /tmp/seed-blog-posts.php --path=/opt/bitnami/wordpress --allow-root"

echo ""
echo "Scheduled posts in database:"
ssh -i "$KEY" -o StrictHostKeyChecking=no "$REMOTE" \
  "sudo /opt/bitnami/wp-cli/bin/wp post list --post_type=post --post_status=future --fields=post_date,post_title --format=table --path=/opt/bitnami/wordpress --allow-root"

rm -f "$TAR"
echo "Done. Edit posts in wp-admin after seeding; re-run is idempotent."
