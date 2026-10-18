#!/usr/bin/env bash
# Faz 26 — NB PM-8 bildirim matrisi
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 26 doğrulama ==="
test -f "${ROOT}/server/postaNotificationMatrix.mjs" || exit 1

posta_curl "${BASE}/api/posta/notifications/matrix" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.catalog?.events?.length || !d.matrix?.contact) process.exit(1);
console.log('OK   notifications matrix', d.catalog.events.length, 'events');
"

echo "✓ Faz 26 doğrulama geçti"
