#!/usr/bin/env bash
# Faz 16 — compose tam parite smoke
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 16 doğrulama ==="

test -f "${ROOT}/server/postaComposeActions.mjs" || { echo "HATA: postaComposeActions.mjs eksik"; exit 1; }
test -f "${ROOT}/src/components/posta/PostaComposePanel.tsx" || { echo "HATA: PostaComposePanel eksik"; exit 1; }

curl -fsS -X POST "${BASE}/api/email/test" \
  -H 'Content-Type: application/json' \
  -d '{"to":"smoke@example.com","cc":"cc@example.com","subject":"Faz16 smoke","body":"**test**"}' | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(d.ok===false && d.error && d.error.includes('Geçersiz')) process.exit(1);
console.log('OK   compose API cc alanı kabul');
"

posta_curl -X POST "${BASE}/api/posta/drafts" \
  -H 'Content-Type: application/json' \
  -d '{"to":"draft@example.com","cc":"a@b.com","subject":"t","body":"x"}' | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.draft?.cc) process.exit(1);
console.log('OK   taslak cc/bcc şeması');
"

echo "✓ Faz 16 doğrulama geçti"
