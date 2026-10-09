#!/usr/bin/env bash
# E2E Akış A — iletişim formu → Gelen → yanıt → Gönderilen + outbox CSV
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${ROOT}"
STAMP="$(date +%s)"
MARKER="Ekolojik Akis A smoke ${STAMP}"
TEST_EMAIL="akis-a-smoke+${STAMP}@ekolojikmarket.com.tr"
TEST_NAME="Akis A Smoke"

echo "=== Ekolojik Posta Akış A smoke ==="
echo "API: ${BASE_URL}"

UNREAD_BEFORE="$(posta_curl "${BASE_URL}/api/posta/unread-counts" 2>/dev/null || echo '{}')"
echo "unread (önce): ${UNREAD_BEFORE}"

CONTACT_JSON="$(curl -fsS -X POST "${BASE_URL}/api/contact" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<EOF
{"name":"${TEST_NAME}","email":"${TEST_EMAIL}","subject":"genel","message":"${MARKER}","phone":"5550000000"}
EOF
)"

echo "contact: ${CONTACT_JSON}"
echo "${CONTACT_JSON}" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
if (!j.ok) { console.error('HATA: iletişim kaydı', j.message||j); process.exit(1); }
"

sleep 1

INBOX_FILE="$(mktemp)"
trap 'rm -f "${INBOX_FILE}"' EXIT
posta_curl "${BASE_URL}/api/posta/inbox?folder=gelen&limit=80" > "${INBOX_FILE}"
M="${MARKER}" node -e "
const marker=process.env.M;
const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));
const hit=(j.items||[]).find((i)=>
  i.kind==='contact' &&
  String(i.preview||'').includes(marker) &&
  String(i.bodyText||'').includes(marker) &&
  !String(i.bodyText||'').trim().startsWith('{')
);
if (!hit) {
  console.error('HATA: Gelen iletişim satırı yok veya gövde okunmuyor');
  console.error('items', (j.items||[]).length);
  process.exit(2);
}
console.log('OK   Gelen iletişim', hit.id, hit.subject);
" "${INBOX_FILE}" || exit 2

UNREAD_AFTER="$(posta_curl "${BASE_URL}/api/posta/unread-counts")"
echo "unread (sonra): ${UNREAD_AFTER}"
BEFORE="${UNREAD_BEFORE}" AFTER="${UNREAD_AFTER}" node -e "
const before=JSON.parse(process.env.BEFORE);
const after=JSON.parse(process.env.AFTER);
if ((after.gelen??0) < (before.gelen??0)) {
  console.error('UYARI: gelen unread düştü — beklenmeyen');
}
if ((after.gelen??0) <= (before.gelen??0)) {
  console.error('HATA: yeni iletişim gelen rozetini artırmadı');
  process.exit(3);
}
console.log('OK   gelen unread arttı', before.gelen, '→', after.gelen);
" || exit 3

REPLY_TO="${EKOLOJIK_AKIS_A_REPLY_TO:-info@ekolojikmarket.com.tr}"
REPLY_SUBJ="Re: Genel — ${STAMP}"
REPLY_BODY="Akis A operator yaniti — ${STAMP}"
SEND="$(posta_curl -X POST "${BASE_URL}/api/email/test" \
  -H 'Content-Type: application/json' \
  -d "$(node -e "console.log(JSON.stringify({to:process.argv[1],subject:process.argv[2],body:process.argv[3]}))" \
    "${REPLY_TO}" "${REPLY_SUBJ}" "${REPLY_BODY}")")"
echo "send: ${SEND}"
echo "${SEND}" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
if (!j.ok) { console.error('HATA: yanıt gönderimi', j.error||j); process.exit(4); }
"

posta_curl -X POST "${BASE_URL}/api/email/outbox/process" >/dev/null 2>&1 || true
sleep 2

RECENT="$(posta_curl "${BASE_URL}/api/email/outbox/recent?limit=30")"
T="${REPLY_TO}" B="${REPLY_BODY}" node -e "
const to=process.env.T;
const body=process.env.B;
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
const hit=(j.items||[]).find((r)=>
  String(r.to||'')===to &&
  String(r.text||r.body||'').includes(body)
);
if (!hit) {
  console.error('HATA: outbox yanıt kaydı yok');
  process.exit(5);
}
console.log('OK   outbox kaydı', hit.id||hit.filename, hit.folder||hit.status);
" <<<"${RECENT}" || exit 5

CSV="$(curl -sS -H "${POSTA_SMOKE_AUTH_H}" "${BASE_URL}/api/posta/export/outbox.csv" 2>/dev/null || true)"
if [[ -z "${CSV}" ]] || ! echo "${CSV}" | grep -qE "${REPLY_TO}|${STAMP}"; then
  echo "HATA: outbox CSV export yanıt alıcısını içermiyor"
  exit 6
fi
echo "OK   outbox.csv export"

echo "✓ Akış A smoke geçti"
exit 0
