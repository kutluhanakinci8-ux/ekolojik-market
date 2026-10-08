#!/usr/bin/env bash
# Sohbet UI testi — mevcut thread'e gelen + giden örnek mesajlar ekler.
# Kullanım:
#   THREAD_ID=em-... bash scripts/sunucu-ekolojik-sohbet-test-diyalog.sh
#   bash scripts/sunucu-ekolojik-sohbet-test-diyalog.sh em-...
#   bash scripts/sunucu-ekolojik-sohbet-test-diyalog.sh   # en son pinned veya ilk thread
set -euo pipefail

ROOT="${1:-}"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
THREAD_ID="${THREAD_ID:-}"

if [[ -n "${ROOT}" && "${ROOT}" != http* ]]; then
  if [[ -z "${THREAD_ID}" ]]; then
    THREAD_ID="${ROOT}"
    ROOT=""
  fi
fi

post_msg() {
  local dir="$1" author="$2" body="$3"
  curl -fsS -X POST "${BASE_URL}/api/messaging/threads/${THREAD_ID}/messages" \
    -H 'Content-Type: application/json' \
    -d "$(node -e "console.log(JSON.stringify({direction:process.argv[1],authorName:process.argv[2],bodyText:process.argv[3]}))" "$dir" "$author" "$body")" \
    >/dev/null
  sleep 0.35
}

if [[ -z "${THREAD_ID}" ]]; then
  THREAD_ID="$(curl -fsS "${BASE_URL}/api/messaging/threads?limit=20" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
const t=(j.threads||[]).find((x)=>x.pinned)||(j.threads||[])[0];
if (!t?.id) { console.error('Thread bulunamadı'); process.exit(1); }
console.log(t.id);
")"
fi

echo "=== Sohbet test diyalogu ==="
echo "API: ${BASE_URL}"
echo "Thread: ${THREAD_ID}"

post_msg customer Musteri "Merhaba, bu hafta organik domates stokta var mı?"
post_msg staff POS "Merhaba! Evet, çiftlikten gelen domatesler bugün rafta. İsterseniz 2 kg paket de ayırabiliriz."
post_msg customer Musteri "Harika, 2 kg ayırır mısınız? Yarın öğleden sonra uğrayacağım."
post_msg staff POS "Not aldım — 2 kg domates rezerve. Yarın 14:00'e kadar kasada bekler."
post_msg customer Musteri "Teşekkürler, görüşmek üzere."
post_msg staff POS "Rica ederiz, iyi günler!"

curl -fsS "${BASE_URL}/api/messaging/threads/${THREAD_ID}/messages?limit=30" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
const msgs=j.messages||[];
console.log('OK   mesaj sayısı:', msgs.length);
for (const m of msgs.slice(-8)) {
  console.log('   ', m.direction, '-', (m.bodyText||'').slice(0, 72));
}
"
