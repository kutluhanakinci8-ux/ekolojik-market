#!/usr/bin/env bash
# NB Lerta Posta ↔ Ekolojik — API kapısı (Faz 38+ auth; UI satırları manuel)
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

curl_ok_auth() {
  curl -fsS -H "$1" "$2" | grep -q "$3"
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" "$1"
}

echo "=== Ekolojik Posta NB checklist (API) ==="
echo "API: ${BASE_URL}"
echo ""

check 10 "Bağımsız altyapı" curl_ok "${BASE_URL}/api/system/ekolojik-isolation" '"ok":true'
check 7b "E-posta health" curl_ok "${BASE_URL}/api/email/health" '"ok":true'
check 7 "SSE endpoint" bash -c "curl -fsS -N --max-time 5 '${BASE_URL}/api/posta/events' 2>/dev/null | head -c 8 | grep -q ."
check 40w "Widget statik" bash -c "curl -fsS '${BASE_URL}/widget/messaging.js' | head -c 40 | grep -q ."
check 38a "Export anonim korumalı" bash -c "[[ $(http_code '${BASE_URL}/api/posta/export/outbox.csv') == '401' ]]"
check 38b "Messaging threads anonim korumalı" bash -c "[[ $(http_code '${BASE_URL}/api/messaging/threads?limit=1') == '401' ]]"
check 38c "Portal session geçersiz token" bash -c "[[ $(http_code '${BASE_URL}/api/public/messaging/v1/portal/session?token=bad') == '401' ]]"
check 50 "Public messaging capabilities" curl_ok "${BASE_URL}/api/public/messaging/v1/capabilities" '"apiPrefix"'

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-qa-token.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-qa-token.sh"
TOKEN=""
EKOLOJIK_POS_QA_TOKEN_USER=""
EKOLOJIK_QA_DATA_DIR="${ROOT}/data"
export EKOLOJIK_QA_DATA_DIR
if TOKEN="$(ekolojik_resolve_posta_qa_token "${BASE_URL}")"; then
  echo "OK   #auth pos-token (${EKOLOJIK_POS_QA_TOKEN_USER:-qa}) Posta yetkili"
else
  TOKEN=""
fi

if [[ -n "${TOKEN}" ]]; then
  AUTH_H="Authorization: Bearer ${TOKEN}"
  check 1 "Nav badge — unread API" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/posta/unread-counts" '"ok":true'
  check 2 "Hub API — inbox" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/posta/inbox?folder=gelen&limit=3" '"ok":true'
  check 3 "Gelen birleşik inbox" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/posta/inbox?folder=gelen&limit=5" '"items"'
  check 4 "Yaz — şablon" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/posta/templates" '"templates"'
  check 4b "compose hints" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/posta/compose-hints?limit=5" '"emails"'
  check 5 "Müşteri mesajları" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/messaging/threads?limit=5" '"ok":true'
  check 6 "Gönderilen / outbox" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/email/outbox/recent?limit=5" '"items"'
  check 8 "Posta ayarları" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/posta/settings" '"ok":true'
  check 9 "Export CSV (auth)" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/posta/export/outbox.csv" 'alici;konu'
  check 49 "Messaging SLA" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/messaging/sla?days=7" '"ok":true'
  check 49b "Bot config hub" curl_ok_auth "${AUTH_H}" "${BASE_URL}/api/messaging/bot-config" '"bot"'
else
  echo "WARN #1-9 Oturum token yok — EKOLOJIK_POS_QA_TOKEN veya demo kullanıcı ile tam kapı çalıştırın"
  check 1s "Unread API korumalı (anon)" bash -c "[[ $(http_code '${BASE_URL}/api/posta/unread-counts') == '401' ]]"
fi

if [[ $FAIL -eq 0 ]]; then
  echo ""
  echo "✓ NB checklist API kapısı geçti (UI: docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md)"
  exit 0
fi
echo ""
echo "HATA: NB checklist API — yukarıdaki FAIL satırları"
exit 1
