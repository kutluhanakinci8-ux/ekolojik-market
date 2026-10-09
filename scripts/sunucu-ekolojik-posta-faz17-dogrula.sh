#!/usr/bin/env bash
# Faz 17 — kişiler & takvim smoke
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 17 doğrulama ==="

test -f "${ROOT}/server/postaContacts.mjs" || { echo "HATA: postaContacts.mjs eksik"; exit 1; }
test -f "${ROOT}/server/postaCalendar.mjs" || { echo "HATA: postaCalendar.mjs eksik"; exit 1; }

posta_curl "${BASE}/api/posta/contacts?limit=5" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !Array.isArray(d.contacts)) process.exit(1);
console.log('OK   contacts', d.contacts.length);
"

posta_curl "${BASE}/api/posta/calendar?limit=10" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !Array.isArray(d.events)) process.exit(1);
console.log('OK   calendar', d.events.length, 'etkinlik');
"

echo "✓ Faz 17 doğrulama geçti"
