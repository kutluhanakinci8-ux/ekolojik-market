#!/usr/bin/env bash
# Demo müşteri yazışmaları — 2 ayrı thread (gelen + giden örnek diyalog).
# Kullanım:
#   bash scripts/sunucu-ekolojik-sohbet-ornek-musteriler.sh
#   EKOLOJIK_VERIFY_BASE_URL=http://168.231.109.27:5180 bash scripts/...
set -euo pipefail

BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
STAMP="$(date +%s)"

pin_thread() {
  local tid="$1"
  curl -fsS -X POST "${BASE_URL}/api/messaging/threads/${tid}/flags" \
    -H 'Content-Type: application/json' \
    -d '{"pinned":true}' >/dev/null
}

post_msg() {
  local tid="$1" dir="$2" author="$3" body="$4"
  curl -fsS -X POST "${BASE_URL}/api/messaging/threads/${tid}/messages" \
    -H 'Content-Type: application/json' \
    -d "$(node -e "console.log(JSON.stringify({direction:process.argv[1],authorName:process.argv[2],bodyText:process.argv[3]}))" "$dir" "$author" "$body")" \
    >/dev/null
  sleep 0.35
}

create_thread() {
  local cid="$1" name="$2" email="$3" subject="$4" initial="$5"
  curl -fsS -X POST "${BASE_URL}/api/messaging/threads" \
    -H 'Content-Type: application/json' \
    -d "$(node -e "
const first = process.argv[2].split(' ')[0];
console.log(JSON.stringify({
  customerId: process.argv[1],
  customerName: process.argv[2],
  customerEmail: process.argv[3],
  subject: process.argv[4],
  initialMessage: process.argv[5],
  initialDirection: 'customer',
  authorName: first
}));
" "$cid" "$name" "$email" "$subject" "$initial")"
}

echo "=== Ekolojik Sohbet — örnek müşteriler ==="
echo "API: ${BASE_URL}"

echo "→ Zeynep Demir (glütensiz ekmek)"
Z_JSON="$(create_thread "demo-zeynep-${STAMP}" "DEMO · Zeynep Demir" "zeynep.demo+${STAMP}@ekolojikmarket.com.tr" "Örnek: Glütensiz ekmek" "Merhaba, glütensiz tam buğday ekmeğiniz bugün var mı? Akşam 18:00 civarı gelmeyi planlıyorum.")"
Z_ID="$(echo "${Z_JSON}" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.ok) {console.error(j); process.exit(1);} console.log(j.thread.id);")"
post_msg "${Z_ID}" staff POS "Merhaba Zeynep Hanım, evet — sabah fırından 12 adet geldi, şu an 7 adet kaldı. İsterseniz 2 adet ayırabilirim."
post_msg "${Z_ID}" customer Zeynep "Süper, 2 adet ayırır mısınız lütfen? İsim: Zeynep Demir."
post_msg "${Z_ID}" staff POS "Ayırdım ✓ Kasada 'Zeynep — glütensiz ekmek x2' notuyla bekliyor. İyi günler!"
pin_thread "${Z_ID}"
echo "   thread ${Z_ID} (4 mesaj, sabitlendi)"

echo "→ Mehmet Kaya (zeytinyağı / kurumsal)"
M_JSON="$(create_thread "demo-mehmet-${STAMP}" "DEMO · Mehmet Kaya" "mehmet.kaya.demo+${STAMP}@ekolojikmarket.com.tr" "Örnek: Ofis zeytinyağı" "Selam, 5 litre naturel sızma zeytinyağı fiyatınız nedir? Şirket için düzenli alım düşünüyoruz.")"
M_ID="$(echo "${M_JSON}" | node -e "const j=JSON.parse(require('fs').readFileSync(0,'utf8')); if(!j.ok) {console.error(j); process.exit(1);} console.log(j.thread.id);")"
post_msg "${M_ID}" staff POS "Merhaba Mehmet Bey, 5 L cam şişe naturel sızma bugün ₺1.890 (KDV dahil). 3+ alımda %5 kurumsal indirim uyguluyoruz."
post_msg "${M_ID}" customer Mehmet "Anladım. Perşembe sabahı 2 koli (10 L) alabilir miyim? Fatura şirket adına kesilecek."
post_msg "${M_ID}" staff POS "Tabii — Perşembe 09:00–12:00 arası hazır olur. Şirket ünvanı ve VKN'yi bu yazışmaya yazarsanız faturayı hazırlarız."
pin_thread "${M_ID}"
echo "   thread ${M_ID} (4 mesaj, sabitlendi)"

curl -fsS "${BASE_URL}/api/messaging/threads?limit=12" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('');
console.log('Liste (son):');
for (const t of (j.threads||[]).slice(0,6)) {
  console.log('  •', t.customerName, '—', t.subject, '('+t.messageCount+' mesaj)');
}
"
echo "✓ Örnek müşteri yazışmaları hazır"
