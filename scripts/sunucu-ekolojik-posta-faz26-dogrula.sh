#!/usr/bin/env bash
# Faz 26 — NB PM-8 bildirim matrisi
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 26 doğrulama ==="
test -f "${ROOT}/server/postaNotificationMatrix.mjs" || exit 1

curl -fsS "${BASE}/api/posta/notifications/matrix" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.catalog?.events?.length || !d.matrix?.contact) process.exit(1);
console.log('OK   notifications matrix', d.catalog.events.length, 'events');
"

echo "✓ Faz 26 doğrulama geçti"
