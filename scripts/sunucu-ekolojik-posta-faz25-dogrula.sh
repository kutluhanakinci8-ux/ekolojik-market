#!/usr/bin/env bash
# Faz 25 — NB PM-3/PM-7 deliverability hub
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 25 doğrulama ==="
test -f "${ROOT}/server/postaDeliverability.mjs" || exit 1

curl -fsS "${BASE}/api/posta/deliverability" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.domain || !d.dns) process.exit(1);
console.log('OK   deliverability', d.domain, 'spf', d.dns.spf?.status);
"

echo "✓ Faz 25 doğrulama geçti"
