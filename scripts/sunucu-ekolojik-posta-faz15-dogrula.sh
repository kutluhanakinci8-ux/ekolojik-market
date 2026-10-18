#!/usr/bin/env bash
# Faz 15 — konuşma, arama, filtre smoke
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 15 doğrulama ==="

posta_curl "${BASE}/api/posta/inbox/search?folder=gelen&q=smoke&limit=5" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok) process.exit(1);
console.log('OK   inbox search q=smoke');
"

posta_curl "${BASE}/api/posta/inbox?folder=gelen&listMode=conversation&limit=5" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || d.listMode!=='conversation') process.exit(1);
console.log('OK   listMode=conversation', (d.items||[]).length, 'konuşma');
"

test -f "${ROOT}/server/postaConversation.mjs" || { echo "HATA: postaConversation.mjs eksik"; exit 1; }
echo "✓ Faz 15 doğrulama geçti"
