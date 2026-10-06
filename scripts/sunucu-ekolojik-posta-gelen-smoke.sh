#!/usr/bin/env bash
# Faz 7 kabul — info@ teslim + Posta hub sync smoke
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
TO="${EKOLOJIK_SMOKE_TO:-info@ekolojikmarket.com.tr}"
STAMP="$(date -Iseconds)"

echo "=== Ekolojik Posta Gelen smoke (Faz 7 kabul) ==="

if ! curl -fsS "${BASE_URL}/api/posta/imap/health" | grep -q '"imapVerified":true'; then
  echo "HATA: IMAP doğrulanmamış — önce sunucu-ekolojik-imap-vps-kur.sh --apply"
  exit 1
fi

SUBJECT="Ekolojik Posta smoke ${STAMP}"
BODY="Otomatik Faz 7 gelen kutusu testi — ${STAMP}"

if command -v sendmail >/dev/null 2>&1; then
  printf 'Subject: %s\nFrom: posta-smoke@ekolojikmarket.com.tr\nTo: %s\n\n%s\n' \
    "${SUBJECT}" "${TO}" "${BODY}" | sendmail -f "posta-smoke@ekolojikmarket.com.tr" "${TO}"
  echo "OK   sendmail → ${TO}"
else
  echo "HATA: sendmail yok"
  exit 1
fi

sleep 3

SYNC="$(curl -fsS -X POST "${BASE_URL}/api/posta/inbox/sync" 2>/dev/null || true)"
echo "sync: ${SYNC}"

INBOX="$(curl -fsS "${BASE_URL}/api/posta/inbox?folder=gelen&limit=20" 2>/dev/null || true)"
echo "${INBOX}" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
const subj=process.env.SUBJ;
const hit=(j.items||[]).some((i)=>String(i.subject||'').includes('Ekolojik Posta smoke'));
console.log('items', (j.items||[]).length, 'imapHit', hit);
if (!hit && (j.items||[]).length===0) process.exit(3);
if (!hit) process.exit(4);
" SUBJ="${SUBJECT}" || {
  code=$?
  if [[ $code -eq 3 ]]; then
    echo "HATA: Gelen boş — Postfix alias (sunucu-ekolojik-imap-vps-alias-fix.sh) ve mail.log"
    exit 3
  fi
  echo "UYARI: Test konusu listede yok — iletişim satırı var mı kontrol edin"
  exit 4
}

echo "✓ Faz 7 kabul: Gelen smoke geçti"
exit 0
