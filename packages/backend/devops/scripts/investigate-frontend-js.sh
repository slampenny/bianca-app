#!/usr/bin/env bash
# Run this script ON the staging/production instance (after SSH) to find why
# the frontend JS returns HTML and causes "Unexpected token '<'" in the browser.
# Usage: bash investigate-frontend-js.sh

set -e

echo "=============================================="
echo "Frontend JS investigation (Unexpected token '<')"
echo "=============================================="

# Detect frontend container (staging_frontend, production_frontend, demo_frontend)
FRONTEND_CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '_frontend$' | head -1)
if [ -z "$FRONTEND_CONTAINER" ]; then
  echo "ERROR: No *_frontend container found. Is the frontend container running?"
  docker ps -a --format 'table {{.Names}}\t{{.Status}}' | grep -E 'frontend|nginx|app' || true
  exit 1
fi
echo "Using frontend container: $FRONTEND_CONTAINER"
echo ""

# 1. Show script srcs from index.html
echo "--- 1. Script srcs in index.html ---"
docker exec "$FRONTEND_CONTAINER" cat /usr/share/nginx/html/index.html 2>/dev/null | grep -oE 'src="[^"]+\.js"' || echo "(no script srcs found or no index.html)"
echo ""

# 2. List root of nginx html
echo "--- 2. Contents of /usr/share/nginx/html (frontend container) ---"
docker exec "$FRONTEND_CONTAINER" ls -la /usr/share/nginx/html/ 2>/dev/null || echo "(failed to list)"
echo ""

# 3. List _expo and assets if present (Expo web often uses _expo/static/...)
echo "--- 3. _expo and assets dirs (if any) ---"
docker exec "$FRONTEND_CONTAINER" ls -la /usr/share/nginx/html/_expo 2>/dev/null || echo "_expo: not found or empty"
docker exec "$FRONTEND_CONTAINER" ls -la /usr/share/nginx/html/assets 2>/dev/null || echo "assets: not found or empty"
echo ""

# 4. First script src: does that file exist in the container?
SCRIPT_SRC=$(docker exec "$FRONTEND_CONTAINER" cat /usr/share/nginx/html/index.html 2>/dev/null | grep -oE 'src="[^"]+\.js"' | head -1 | sed 's/src="//;s/"$//')
if [ -n "$SCRIPT_SRC" ]; then
  # Normalize: remove leading slash for path check
  FILE_PATH="${SCRIPT_SRC#/}"
  echo "--- 4. First script src: $SCRIPT_SRC ---"
  echo "Checking if file exists at /usr/share/nginx/html/$FILE_PATH"
  docker exec "$FRONTEND_CONTAINER" test -f "/usr/share/nginx/html/$FILE_PATH" 2>/dev/null && echo "FILE EXISTS" || echo "FILE MISSING"
  # Also try with leading slash
  docker exec "$FRONTEND_CONTAINER" test -f "/usr/share/nginx/html/$SCRIPT_SRC" 2>/dev/null && echo "FILE EXISTS (with leading slash)" || true
else
  echo "--- 4. No script src found in index.html ---"
fi
echo ""

# 5. Curl the JS URL from inside the container (localhost:80)
if [ -n "$SCRIPT_SRC" ]; then
  echo "--- 5. Response for GET $SCRIPT_SRC (from inside container, localhost:80) ---"
  RESP=$(docker exec "$FRONTEND_CONTAINER" curl -s -w "\nHTTP_CODE:%{http_code}" "http://127.0.0.1$SCRIPT_SRC" 2>/dev/null || echo "curl failed")
  HTTP_CODE=$(echo "$RESP" | grep "HTTP_CODE:" | sed 's/HTTP_CODE://')
  BODY=$(echo "$RESP" | sed '/HTTP_CODE:/d')
  echo "HTTP code: $HTTP_CODE"
  echo "First 200 chars of body:"
  echo "$BODY" | head -c 200
  echo ""
  if [ -n "$BODY" ] && [[ "$BODY" == \<* ]]; then
    echo ">>> BODY STARTS WITH '<' — server is returning HTML instead of JS (root cause of Unexpected token '<')"
    if [ "$HTTP_CODE" = "404" ]; then
      echo ">>> HTTP 404: the JS file is missing; nginx is serving its default HTML 404 page."
      echo ">>> Fix: ensure the file exists in the container (Expo puts it in _expo/static/js/web/; Dockerfile must copy full dist/)."
    fi
  fi
else
  echo "--- 5. Skipped (no script src) ---"
fi
echo ""

# 6. Nginx config in frontend container (relevant locations)
echo "--- 6. Nginx config (server block and location for .js) ---"
docker exec "$FRONTEND_CONTAINER" cat /etc/nginx/nginx.conf 2>/dev/null | sed -n '/server {/,/^}/p' | head -60 || echo "(could not read nginx config)"
echo ""

echo "=============================================="
echo "Summary:"
echo "  (4) FILE MISSING → path in index.html does not match files in container (fix build path or Dockerfile copy)."
echo "  (5) HTTP 404 + body starts with '<' → JS file missing; nginx default 404 is HTML (fix: ensure file exists)."
echo "  (5) HTTP 200 but body starts with '<' → nginx serving index.html for .js (fix: nginx location / try_files)."
echo "Expo web output: index.html references /_expo/static/js/web/index-<hash>.js; files live in dist/_expo/static/js/web/."
echo "=============================================="
