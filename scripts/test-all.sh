#!/usr/bin/env bash
# Run full test suite in order; exit non-zero on first failure and print a visible banner.
#
# Step 4 (web Cucumber) needs a running API and Vite app.
# Default FRONTEND_URL is Vite (5173). CodeBuild RunTests exports FRONTEND_URL=http://localhost:8081.
# If Vite picked another port, set FRONTEND_URL, e.g. FRONTEND_URL=http://127.0.0.1:5175
set -eo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

on_err() {
  local status=$?
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  test:all FAILED (exit code ${status})"
  echo "  Scroll up to the section above for the real error — the process stopped here."
  echo "  Re-run only the failing step, e.g.:"
  echo "    yarn workspace @bianca-app/backend test:unit"
  echo "    yarn test:web"
  echo "    yarn test:integration"
  echo "    FRONTEND_URL=... API_URL=... yarn workspace @bianca-app/web test:cucumber"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit "${status}"
}
trap on_err ERR

echo ""
echo ">>> test:all — 1/4 backend unit tests"
yarn workspace @bianca-app/backend test:unit

echo ""
echo ">>> test:all — 2/4 web unit tests (Vitest)"
yarn test:web

echo ""
echo ">>> test:all — 3/4 backend integration tests"
yarn test:integration

echo ""
echo ">>> test:all — 4/4 web Cucumber E2E (Playwright)"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
export API_URL="${API_URL:-http://localhost:3000}"
export BASE_URL="${BASE_URL:-$FRONTEND_URL}"
echo "    Using FRONTEND_URL=$FRONTEND_URL API_URL=$API_URL"
NODE_ENV=test yarn workspace @bianca-app/web test:cucumber

trap - ERR
echo ""
echo ">>> test:all — all steps passed"
