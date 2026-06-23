#!/bin/bash
# Shared environment resolution for HIPAA backup/restore scripts.

resolve_hipaa_env() {
  local script_dir="${1:-}"

  if [ -n "${ENVIRONMENT:-}" ]; then
    echo "$ENVIRONMENT"
    return
  fi

  case "$script_dir" in
    /opt/bianca-staging) echo "staging" ;;
    /opt/bianca-production) echo "production" ;;
    /opt/bianca-demo) echo "demo" ;;
    *)
      if [[ "$script_dir" =~ /opt/bianca-(staging|production|demo)$ ]]; then
        echo "${BASH_REMATCH[1]}"
      else
        echo "staging"
      fi
      ;;
  esac
}
