#!/usr/bin/env bash
# Faz 29 — NB PM-10 engagement
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 29 doğrulama ==="
test -f "${ROOT}/server/postaEngagement.mjs" || exit 1

curl -fsS "${BASE}/api/posta/engagement/summary?days=7" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.counts) process.exit(1);
console.log('OK   engagement summary opens', d.counts.opens);
"

curl -fsS "${BASE}/api/posta/engagement/export.csv?type=combined&days=30" | head -n 1 | grep -q '^type,at' || exit 1
echo "OK   engagement export.csv"

echo "✓ Faz 29 doğrulama geçti"
