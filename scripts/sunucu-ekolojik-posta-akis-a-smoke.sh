#!/usr/bin/env bash
# E2E Akış A — iletişim formu → Gelen → yanıt → Gönderilen + outbox CSV
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
STAMP="$(date +%s)"
MARKER="Ekolojik Akis A smoke ${STAMP}"
TEST_EMAIL="akis-a-smoke+${STAMP}@ekolojikmarket.com.tr"
TEST_NAME="Akis A Smoke"

echo "=== Ekolojik Posta Akış A smoke ==="
echo "API: ${BASE_URL}"

UNREAD_BEFORE="$(curl -fsS "${BASE_URL}/api/posta/unread-counts" 2>/dev/null || echo '{}')"
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
curl -fsS "${BASE_URL}/api/posta/inbox?folder=gelen&limit=80" > "${INBOX_FILE}"
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

UNREAD_AFTER="$(curl -fsS "${BASE_URL}/api/posta/unread-counts")"
echo "unread (sonra): ${UNREAD_AFTER}"
echo "${UNREAD_AFTER}" | node -e "
const before=JSON.parse(process.env.B);
const after=JSON.parse(require('fs').readFileSync(0,'utf8'));
if ((after.gelen??0) < (before.gelen??0)) {
  console.error('UYARI: gelen unread düştü — beklenmeyen');
}
if ((after.gelen??0) <= (before.gelen??0)) {
  console.error('HATA: yeni iletişim gelen rozetini artırmadı');
  process.exit(3);
}
console.log('OK   gelen unread arttı', before.gelen, '→', after.gelen);
" B="${UNREAD_BEFORE}" || exit 3

REPLY_SUBJ="Re: Genel — ${STAMP}"
REPLY_BODY="Akis A operator yaniti — ${STAMP}"
SEND="$(curl -fsS -X POST "${BASE_URL}/api/email/test" \
  -H 'Content-Type: application/json' \
  -d "$(node -e "console.log(JSON.stringify({to:process.argv[1],subject:process.argv[2],body:process.argv[3]}))" \
    "${TEST_EMAIL}" "${REPLY_SUBJ}" "${REPLY_BODY}")")"
echo "send: ${SEND}"
echo "${SEND}" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
if (!j.ok) { console.error('HATA: yanıt gönderimi', j.error||j); process.exit(4); }
"

curl -fsS -X POST "${BASE_URL}/api/email/outbox/process" >/dev/null 2>&1 || true
sleep 1

RECENT="$(curl -fsS "${BASE_URL}/api/email/outbox/recent?limit=30")"
echo "${RECENT}" | node -e "
const subj=process.env.S;
const to=process.env.T;
const body=process.env.B;
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
const hit=(j.items||[]).find((r)=>
  String(r.to||'')===to &&
  String(r.text||r.body||'').includes(process.env.B) &&
  (r.folder==='sent' || r.status==='sent')
);
if (!hit) {
  console.error('HATA: Gönderilen/outbox sent satırı yok');
  process.exit(5);
}
console.log('OK   outbox sent', hit.id||hit.filename, hit.status);
" S="${REPLY_SUBJ}" T="${TEST_EMAIL}" B="${REPLY_BODY}" || exit 5

CSV="$(curl -fsS "${BASE_URL}/api/posta/export/outbox.csv?limit=50" 2>/dev/null || true)"
if [[ -z "${CSV}" ]] || ! echo "${CSV}" | grep -q "${TEST_EMAIL}"; then
  echo "HATA: outbox CSV export hedef e-postayı içermiyor"
  exit 6
fi
echo "OK   outbox.csv export"

echo "✓ Akış A smoke geçti"
exit 0
