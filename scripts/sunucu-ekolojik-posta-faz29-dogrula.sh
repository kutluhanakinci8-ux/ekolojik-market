#!/usr/bin/env bash
# Faz 29 — NB PM-10 engagement
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 29 doğrulama ==="
test -f "${ROOT}/server/postaEngagement.mjs" || exit 1

posta_curl "${BASE}/api/posta/engagement/summary?days=7" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.counts) process.exit(1);
console.log('OK   engagement summary opens', d.counts.opens);
"

ENG_CSV_HEAD="$(posta_curl "${BASE}/api/posta/engagement/export.csv?type=combined&days=30" 2>/dev/null | head -n 1 || true)"
echo "${ENG_CSV_HEAD}" | grep -q '^type,at' || exit 1
echo "OK   engagement export.csv"

echo "✓ Faz 29 doğrulama geçti"
