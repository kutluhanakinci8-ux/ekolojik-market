#!/usr/bin/env bash
# Faz 19 — depolama, toplu işlem smoke
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 19 doğrulama ==="

test -f "${ROOT}/server/postaStorage.mjs" || exit 1
test -f "${ROOT}/server/postaAudit.mjs" || exit 1

posta_curl "${BASE}/api/posta/storage" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || d.maxAttachmentBytes !== 10485760) process.exit(1);
console.log('OK   storage percent', d.percent);
"

posta_curl -X POST "${BASE}/api/posta/inbox/mark-all-read" \
  -H 'Content-Type: application/json' \
  -d '{"folder":"gelen"}' | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok) process.exit(1);
console.log('OK   mark-all-read', d.processed);
"

echo "✓ Faz 19 doğrulama geçti"
