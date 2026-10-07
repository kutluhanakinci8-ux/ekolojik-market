#!/usr/bin/env bash
# Faz 18 — sohbet tam parite smoke
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 18 doğrulama ==="

test -f "${ROOT}/server/messaging/store.mjs" || exit 1

curl -fsS "${BASE}/api/messaging/threads?limit=5" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !Array.isArray(d.threads)) process.exit(1);
console.log('OK   threads', d.threads.length);
"

THREAD=$(curl -fsS "${BASE}/api/messaging/threads?limit=1" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
const id=d.threads?.[0]?.id;
if(!id) { console.log('SKIP'); process.exit(0); }
console.log(id);
")

if [[ -n "${THREAD}" && "${THREAD}" != "SKIP" ]]; then
  curl -fsS -X POST "${BASE}/api/messaging/threads/${THREAD}/flags" \
    -H 'Content-Type: application/json' \
    -d '{"pinned":true}' | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok) process.exit(1);
console.log('OK   thread flags');
"
  curl -fsS "${BASE}/api/messaging/threads/${THREAD}/messages?q=test&limit=5" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok) process.exit(1);
console.log('OK   thread message search');
"
fi

echo "✓ Faz 18 doğrulama geçti"
