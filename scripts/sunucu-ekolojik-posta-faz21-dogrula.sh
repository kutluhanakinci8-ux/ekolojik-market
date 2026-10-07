#!/usr/bin/env bash
# Faz 21 — kısayollar, offline SW, doküman smoke
set -euo pipefail

ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
RUNTIME="${EKOLOJIK_VERIFY_RUNTIME:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"

echo "=== Ekolojik Posta Faz 21 doğrulama ==="

test -f "${ROOT}/public/posta-offline-sw.js" || exit 1
test -f "${ROOT}/docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md" || exit 1

curl -fsS "${BASE}/posta-offline-sw.js" | head -1 | grep -q 'Faz 21' || {
  echo "FAIL SW static"
  exit 1
}
echo "OK   posta-offline-sw.js"

BUNDLE="$(ls -1 "${RUNTIME}/dist/assets"/index-*.js 2>/dev/null | head -1)"
test -n "${BUNDLE}" || BUNDLE="$(ls -1 "${ROOT}/dist/assets"/index-*.js 2>/dev/null | head -1)"
grep -q 'posta-hub-hotkeys-hint' "${BUNDLE}" || { echo "FAIL bundle hotkeys"; exit 1; }
echo "OK   hub hotkeys UI"

echo "✓ Faz 21 doğrulama geçti"
