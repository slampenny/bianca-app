#!/bin/bash
# Build HIPAA backup Lambda deployment packages (non-interactive).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

zip_one() {
  local dir="$1"
  local out="$2"
  (cd "$dir" && npm install --omit=dev)
  rm -f "$out"
  python3 - "$dir" "$out" <<'PY'
import sys, zipfile, os
src, out = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, _dirs, files in os.walk(src):
        for name in files:
            path = os.path.join(root, name)
            arc = os.path.relpath(path, src)
            zf.write(path, arc)
PY
}

echo "Building lambda-backup.zip..."
zip_one lambda-backup lambda-backup.zip

echo "Building lambda-verify-backup.zip..."
zip_one lambda-verify lambda-verify-backup.zip

echo "Building lambda-restore.zip..."
zip_one lambda-restore lambda-restore.zip

echo "Done. Created:"
ls -lh lambda-backup.zip lambda-verify-backup.zip lambda-restore.zip
file lambda-backup.zip lambda-verify-backup.zip lambda-restore.zip
