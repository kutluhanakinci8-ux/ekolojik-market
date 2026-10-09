#!/usr/bin/env bash
# Faz 30 — NB PM-4 PWA web push (VAPID)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 30 doğrulama ==="
test -f "${ROOT}/server/postaWebPush.mjs" || exit 1
test -f "${ROOT}/public/manifest.webmanifest" || exit 1

posta_curl "${BASE}/api/posta/push/config" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok) process.exit(1);
console.log('OK   push config configured', d.configured);
"

curl -fsS "${BASE}/posta-offline-sw.js" | grep -q "notificationclick" || exit 1
echo "OK   SW push handlers"

echo "✓ Faz 30 doğrulama geçti"
