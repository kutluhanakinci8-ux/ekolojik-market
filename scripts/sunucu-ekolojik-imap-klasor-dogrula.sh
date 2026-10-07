#!/usr/bin/env bash
# Faz 14 — IMAP klasör sync + birleşik gönderilen API smoke
set -euo pipefail

ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"

echo "=== Ekolojik IMAP klasör parite (Faz 14) ==="
echo "API: ${BASE}"

curl -fsS "${BASE}/api/posta/sent?limit=3" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok) { console.error('sent API fail'); process.exit(1); }
console.log('OK   GET /api/posta/sent', (d.items||[]).length, 'satır');
"

curl -fsS "${BASE}/api/posta/inbox?folder=taslaklar&limit=3" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok) { console.error('taslaklar inbox fail'); process.exit(1); }
console.log('OK   GET /api/posta/inbox?folder=taslaklar');
"

for f in postaImapMailboxes.mjs postaImapActions.mjs; do
  test -f "${ROOT}/server/${f}" || { echo "HATA: server/${f} eksik"; exit 1; }
done
echo "OK   Faz 14 sunucu modülleri"
echo "✓ Faz 14 IMAP klasör doğrulama"
