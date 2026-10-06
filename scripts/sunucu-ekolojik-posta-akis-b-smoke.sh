#!/usr/bin/env bash
# E2E Akış B — müşteri mesajı → ops bildirimi → staff yanıtı → unread
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
STAMP="$(date +%s)"
MARKER="Ekolojik Akis B smoke ${STAMP}"
CUSTOMER_ID="smoke-cust-${STAMP}"
CUSTOMER_NAME="Akis B Musteri"
CUSTOMER_EMAIL="akis-b-smoke+${STAMP}@ekolojikmarket.com.tr"

echo "=== Ekolojik Posta Akış B smoke ==="
echo "API: ${BASE_URL}"

UNREAD_BEFORE="$(curl -fsS "${BASE_URL}/api/posta/unread-counts" 2>/dev/null || echo '{}')"
echo "unread (önce): ${UNREAD_BEFORE}"

THREAD_JSON="$(curl -fsS -X POST "${BASE_URL}/api/messaging/threads" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<EOF
{"customerId":"${CUSTOMER_ID}","customerName":"${CUSTOMER_NAME}","customerEmail":"${CUSTOMER_EMAIL}","subject":"Akis B test ${STAMP}","initialMessage":"${MARKER}","initialDirection":"customer","authorName":"Musteri"}
EOF
)"

echo "thread: ${THREAD_JSON}"
THREAD_ID="$(echo "${THREAD_JSON}" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
if (!j.ok || !j.thread?.id) {
  console.error('HATA: thread oluşturulamadı', j.error||j);
  process.exit(1);
}
const n=j.notifications||{};
if (n.opsSkipped) {
  console.error('HATA: ops bildirimi atlandı (posta ayarları / EKOLOJIK_OPS_EMAIL)');
  process.exit(2);
}
if (!n.ops?.ok) {
  console.error('HATA: ops SMTP bildirimi', n.ops?.error||n);
  process.exit(2);
}
console.log(j.thread.id);
")"

echo "OK   thread ${THREAD_ID} + ops bildirimi"

sleep 1

UNREAD_MID="$(curl -fsS "${BASE_URL}/api/posta/unread-counts")"
echo "unread (müşteri mesajı): ${UNREAD_MID}"
BEFORE="${UNREAD_BEFORE}" AFTER="${UNREAD_MID}" node -e "
const before=JSON.parse(process.env.BEFORE);
const after=JSON.parse(process.env.AFTER);
if ((after.messaging??0) <= (before.messaging??0)) {
  console.error('HATA: messaging unread artmadı', before.messaging, after.messaging);
  process.exit(3);
}
console.log('OK   messaging unread arttı', before.messaging, '→', after.messaging);
" || exit 3

THREADS="$(curl -fsS "${BASE_URL}/api/messaging/threads?limit=30&customerId=${CUSTOMER_ID}")"
M="${MARKER}" node -e "
const marker=process.env.M;
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
const hit=(j.threads||[]).find((t)=>String(t.lastMessagePreview||'').includes(marker));
if (!hit) {
  console.error('HATA: thread listesinde smoke mesajı yok');
  process.exit(4);
}
console.log('OK   thread listede', hit.id);
" <<<"${THREADS}" || exit 4

STAFF_BODY="Akis B staff yaniti ${STAMP}"
REPLY_JSON="$(curl -fsS -X POST "${BASE_URL}/api/messaging/threads/${THREAD_ID}/messages" \
  -H 'Content-Type: application/json' \
  -d "$(node -e "console.log(JSON.stringify({bodyText:process.argv[1],direction:'staff',authorName:'POS'}))" "${STAFF_BODY}")")"

echo "${REPLY_JSON}" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
if (!j.ok || !j.message) {
  console.error('HATA: staff yanıtı', j.error||j);
  process.exit(5);
}
if (j.message.direction !== 'staff') {
  console.error('HATA: yön staff değil');
  process.exit(5);
}
console.log('OK   staff yanıt', j.message.id);
" || exit 5

MSGS="$(curl -fsS "${BASE_URL}/api/messaging/threads/${THREAD_ID}/messages?limit=20")"
B="${STAFF_BODY}" M="${MARKER}" node -e "
const body=process.env.B;
const marker=process.env.M;
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
const msgs=j.messages||[];
if (!msgs.some((m)=>m.direction==='customer'&&String(m.bodyText||'').includes(marker))) {
  console.error('HATA: müşteri mesajı thread içinde yok');
  process.exit(6);
}
if (!msgs.some((m)=>m.direction==='staff'&&String(m.bodyText||'').includes(body))) {
  console.error('HATA: staff yanıtı thread içinde yok');
  process.exit(6);
}
console.log('OK   thread mesajları', msgs.length);
" <<<"${MSGS}" || exit 6

UNREAD_AFTER="$(curl -fsS "${BASE_URL}/api/posta/unread-counts")"
echo "unread (staff yanıt): ${UNREAD_AFTER}"
BEFORE="${UNREAD_BEFORE}" AFTER="${UNREAD_AFTER}" node -e "
const before=JSON.parse(process.env.BEFORE);
const after=JSON.parse(process.env.AFTER);
if ((after.messaging??0) !== (before.messaging??0)) {
  console.error('UYARI: staff sonrası messaging', before.messaging, '→', after.messaging);
}
console.log('OK   messaging unread staff sonrası', after.messaging);
"

CSV="$(curl -fsS "${BASE_URL}/api/posta/export/outbox.csv" 2>/dev/null || true)"
if [[ -z "${CSV}" ]] || ! echo "${CSV}" | grep -q 'messaging-ops'; then
  echo "HATA: outbox CSV messaging-ops kaynağı yok"
  exit 7
fi
echo "OK   outbox.csv messaging-ops"

echo "✓ Akış B smoke geçti"
exit 0
