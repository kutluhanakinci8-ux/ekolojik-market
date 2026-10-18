#!/usr/bin/env bash
# Faz 20 — kurallar, analitik, AI/track API smoke
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 20 doğrulama ==="

test -f "${ROOT}/server/postaRules.mjs" || exit 1
test -f "${ROOT}/server/postaOutboxAnalytics.mjs" || exit 1

posta_curl "${BASE}/api/posta/rules" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !Array.isArray(d.rules) || !d.rules.length) process.exit(1);
console.log('OK   rules', d.rules.length);
"

posta_curl "${BASE}/api/posta/outbox/analytics?days=14" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.counts) process.exit(1);
console.log('OK   analytics sent', d.window?.sent ?? 0);
"

AI_JSON="$(curl -sS -H "${POSTA_SMOKE_AUTH_H}" -X POST "${BASE}/api/posta/compose/ai-suggest" \
  -H 'Content-Type: application/json' \
  -d '{"subject":"test","body":"smoke"}')"
echo "${AI_JSON}" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(d.ok) { console.log('OK   ai enabled'); process.exit(0); }
if(d.error && String(d.error).includes('EKOLOJIK_POSTA_AI')) { console.log('OK   ai disabled default'); process.exit(0); }
process.exit(1);
"

echo "✓ Faz 20 doğrulama geçti"
