#!/usr/bin/env bash
# Run full test suite in order; exit non-zero on first failure and print a visible banner.
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
  echo "    yarn workspace @bianca-app/frontend test"
  echo "    yarn test:integration"
  echo "    yarn workspace @bianca-app/frontend test:web:e2e"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit "${status}"
}
trap on_err ERR

echo ""
echo ">>> test:all — 1/4 backend unit tests"
yarn workspace @bianca-app/backend test:unit

echo ""
echo ">>> test:all — 2/4 frontend unit tests"
yarn workspace @bianca-app/frontend test

echo ""
echo ">>> test:all — 3/4 backend integration tests"
yarn test:integration

echo ""
echo ">>> test:all — 4/4 frontend Playwright e2e"
yarn workspace @bianca-app/frontend test:web:e2e

trap - ERR
echo ""
echo ">>> test:all — all steps passed"
