#!/usr/bin/env bash
# Faz 28 — NB PM-5 CalDAV/ICS köprüsü
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 28 doğrulama ==="
test -f "${ROOT}/server/postaCalendarSync.mjs" || exit 1

hub="$(curl -fsS "${BASE}/api/posta/calendar/sync")"
node -e "
const d=JSON.parse(process.argv[1]);
if(!d.ok || !d.ics?.subscribeUrl || !d.ics?.exportUrl) process.exit(1);
console.log('OK   calendar sync hub', d.mode);
" "$hub"

curl -fsS "${BASE}/api/posta/calendar/export.ics" | head -c 40 | grep -q 'BEGIN:VCALENDAR' || exit 1
echo "OK   export.ics"

token="$(node -e "const d=JSON.parse(process.argv[1]);const u=new URL(d.ics.subscribeUrl);console.log(u.searchParams.get('token'));" "$hub")"
curl -fsS "${BASE}/api/posta/calendar/feed.ics?token=${token}" | head -c 40 | grep -q 'BEGIN:VCALENDAR' || exit 1
echo "OK   feed.ics token"

echo "✓ Faz 28 doğrulama geçti"
