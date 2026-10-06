#!/usr/bin/env bash
# NB Lerta Posta ↔ Ekolojik — otomatik API kapısı (UI satırları manuel kalır)
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
FAIL=0

check() {
  local id="$1"
  local label="$2"
  shift 2
  if "$@"; then
    echo "OK   #${id} ${label}"
  else
    echo "FAIL #${id} ${label}"
    FAIL=1
  fi
}

curl_ok() {
  curl -fsS "$1" | grep -q "$2"
}

echo "=== Ekolojik Posta NB checklist (API) ==="
echo "API: ${BASE_URL}"
echo ""

check 1 "Nav badge — unread API" curl_ok "${BASE_URL}/api/posta/unread-counts" '"ok":true'
check 2 "Hub API — inbox + templates" curl_ok "${BASE_URL}/api/posta/inbox?folder=gelen&limit=3" '"ok":true'
check 3 "Gelen birleşik inbox" curl_ok "${BASE_URL}/api/posta/inbox?folder=gelen&limit=5" '"items"'
check 4 "Yaz — şablon + compose hints" curl_ok "${BASE_URL}/api/posta/templates" '"templates"'
check 4b "compose hints" curl_ok "${BASE_URL}/api/posta/compose-hints?limit=5" '"emails"'
check 5 "Müşteri mesajları" curl_ok "${BASE_URL}/api/messaging/threads?limit=5" '"ok":true'
check 6 "Gönderilen / outbox" curl_ok "${BASE_URL}/api/email/outbox/recent?limit=5" '"items"'
check 7 "SSE endpoint" bash -c "curl -fsS -N --max-time 5 '${BASE_URL}/api/posta/events' 2>/dev/null | head -c 8 | grep -q ."
check 8 "Posta ayarları" curl_ok "${BASE_URL}/api/posta/settings" '"ok":true'
check 9 "Export CSV" curl_ok "${BASE_URL}/api/posta/export/outbox.csv" 'alici;konu'
check 10 "Bağımsız altyapı" curl_ok "${BASE_URL}/api/system/ekolojik-isolation" '"ok":true'

if [[ $FAIL -eq 0 ]]; then
  echo ""
  echo "✓ NB checklist API kapısı geçti (UI tablosu: docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md)"
  exit 0
fi
echo ""
echo "HATA: NB checklist API — yukarıdaki FAIL satırları"
exit 1
