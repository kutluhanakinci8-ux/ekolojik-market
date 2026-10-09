#!/usr/bin/env bash
# Faz 21 — kısayollar, offline SW, doküman smoke
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
RUNTIME="${EKOLOJIK_VERIFY_RUNTIME:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"

echo "=== Ekolojik Posta Faz 21 doğrulama ==="

test -f "${ROOT}/public/posta-offline-sw.js" || exit 1
test -f "${ROOT}/docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md" || exit 1

curl -fsS "${BASE}/posta-offline-sw.js" | head -1 | grep -qE 'Faz 21' || {
  echo "FAIL SW static"
  exit 1
}
echo "OK   posta-offline-sw.js"

BUNDLE="$(ls -1 "${RUNTIME}/dist/assets"/index-*.js 2>/dev/null | head -1)"
test -n "${BUNDLE}" || BUNDLE="$(ls -1 "${ROOT}/dist/assets"/index-*.js 2>/dev/null | head -1)"
CSS="$(ls -1 "${RUNTIME}/dist/assets"/index-*.css 2>/dev/null | head -1)"
test -n "${CSS}" || CSS="$(ls -1 "${ROOT}/dist/assets"/index-*.css 2>/dev/null | head -1)"
if [[ -n "${CSS}" ]] && grep -q 'posta-hub-hotkeys-hint' "${CSS}" 2>/dev/null; then
  echo "OK   hub hotkeys (CSS hint — j/k/c/r kapısı: NB UI smoke #11)"
elif [[ -n "${BUNDLE}" ]] && grep -qE 'listMode|posta-hub-screen' "${BUNDLE}" 2>/dev/null; then
  echo "OK   hub bundle (hotkeys — Playwright #11)"
else
  echo "FAIL hub hotkeys / bundle"
  exit 1
fi

echo "✓ Faz 21 doğrulama geçti"
