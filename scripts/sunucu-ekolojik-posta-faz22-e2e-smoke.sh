#!/usr/bin/env bash
# Faz 22 — E2E API: konuşma, ilet şeması, IMAP junk, mesaj thread
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 22 E2E smoke (API) ==="

# Konuşma görünümü (Faz 15)
curl -fsS "${BASE}/api/posta/inbox?folder=gelen&listMode=conversation&limit=10" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || d.listMode!=='conversation') process.exit(1);
const c=(d.items||[]).find(i=>i.kind==='conversation');
console.log('OK   konuşma listesi', (d.items||[]).length, c?'(örnek var)':'(boş)');
"

# İlet / yanıt — compose şema (Faz 16)
test -f "${ROOT}/server/postaComposeActions.mjs" || exit 1
curl -fsS "${BASE}/api/posta/compose-hints?limit=3" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok) process.exit(1);
console.log('OK   ilet/yanıt hints');
"

# IMAP junk / spam klasörü (Faz 14)
curl -fsS "${BASE}/api/posta/inbox?folder=spam&limit=5" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok) process.exit(1);
console.log('OK   spam/junk klasör', (d.items||[]).length);
"

# Müşteri mesaj thread (Faz 18)
curl -fsS "${BASE}/api/messaging/threads?limit=5" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !Array.isArray(d.threads)) process.exit(1);
console.log('OK   messaging threads', d.threads.length);
"

curl -fsS "${BASE}/posta-offline-sw.js" | head -1 | grep -q 'Faz 21' && echo "OK   offline SW (Faz 21)"

echo "✓ Faz 22 E2E API smoke geçti"
