#!/usr/bin/env bash
# Pull CloudWatch logs from staging for OpenAI Realtime / greeting debugging.
#
# Usage:
#   ./scripts/pull-staging-realtime-debug-logs.sh
#       → Last SINCE hours of lines matching broad Realtime/OpenAI patterns → ../realtime-rc-staging-cloudwatch.txt
#   ./scripts/pull-staging-realtime-debug-logs.sh CAxxxxxxxx...
#       → Last 48h of every log line containing that CallSid (full context, no grep filter)
#
# Env:
#   AWS_PROFILE, AWS_REGION (default ca-central-1 if unset and your CLI has a default)
#   SINCE   — for mode 1 only (default 2h), e.g. 6h, 1d
#   OUT     — output file path
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUT="${OUT:-${BACKEND_DIR}/realtime-rc-staging-cloudwatch.txt}"
LOG_GROUP="/bianca/staging/app"
SINCE="${SINCE:-2h}"

header() {
  {
    echo "# Fetched $(date -u +%Y-%m-%dT%H:%M:%SZ) UTC | log group ${LOG_GROUP}"
    echo "# Args: $*"
    echo ""
  } >"$OUT"
}

if [[ -n "${1:-}" ]]; then
  CALL_SID="$1"
  header "filter-log-events pattern=${CALL_SID} max-items=500 last 48h"
  aws logs filter-log-events \
    --log-group-name "$LOG_GROUP" \
    --start-time "$(($(date +%s) * 1000 - 172800000))" \
    --filter-pattern "$CALL_SID" \
    --max-items 500 \
    --output text \
    --query 'events[*].message' >>"$OUT" 2>&1 || true
  echo "Wrote $OUT (CallSid-scoped dump; check for response.created, error, handleApiError)"
  exit 0
fi

# Broad grep: not only [RealtimeRC] — includes errors and raw OpenAI receive lines
PATTERN='RealtimeRC|OpenAI Realtime|handleApiError|API error from OpenAI|openai error event|SENDING: type=response|sendResponseCreate|session\.update sent:|buildSessionConfig|RECEIVED from OpenAI|response\.created|response\.done|output_audio|Initial greeting|Session CREATED|Session UPDATED|Cannot create response|CRITICAL.*response'

header "aws logs tail --since ${SINCE} | grep -E broad pattern"
{
  aws logs tail "$LOG_GROUP" --since "$SINCE" --format short 2>&1 | grep -E "$PATTERN" | tail -n 1200
} >>"$OUT" || true

echo "Wrote $OUT (broad staging Realtime tail, last ~1200 matching lines)"
echo "Tip: pass CallSid as first arg for a full per-call slice without grep."
