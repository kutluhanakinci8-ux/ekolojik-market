#!/usr/bin/env bash
# Faz 11 — posta-mail-settings.json yoksa .env değerleriyle oluştur (UI ile uyumlu)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
ENV_FILE="${INSTALL_DIR}/.env"
SETTINGS="${INSTALL_DIR}/data/posta-mail-settings.json"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
FORCE="${EKOLOJIK_POSTA_SETTINGS_FORCE:-0}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${SCRIPT_DIR}/lib/ekolojik-env-load.sh"
set -a
ekolojik_load_env "${ENV_FILE}"
set +a

if [[ -f "${SETTINGS}" && "${FORCE}" != "1" ]]; then
  echo "OK   posta-mail-settings.json mevcut (üzerine yazmak: EKOLOJIK_POSTA_SETTINGS_FORCE=1)"
  exit 0
fi

FROM_NAME="${EKOLOJIK_MAIL_FROM_NAME:-Ekolojik Market}"
REPLY="${EKOLOJIK_MAIL_REPLY_TO:-${EKOLOJIK_MAIL_FROM:-}}"
OPS="${EKOLOJIK_OPS_EMAIL:-${REPLY}}"

BODY="$(node -e "
const b={
  fromName: process.argv[1],
  replyTo: process.argv[2]||null,
  opsEmail: process.argv[3]||null,
  signatureHtml: '',
  notifications: { contactOpsEmail: true, messagingOpsEmail: true, billEmailOpsEmail: true },
};
console.log(JSON.stringify(b));
" "${FROM_NAME}" "${REPLY}" "${OPS}")"

HTTP="$(curl -fsS -o /tmp/ek-posta-settings-put.json -w '%{http_code}' \
  -X PUT "${BASE_URL}/api/posta/settings" \
  -H 'Content-Type: application/json' \
  --data-binary "${BODY}")"

if [[ "${HTTP}" != "200" ]]; then
  echo "HATA: PUT /api/posta/settings HTTP ${HTTP}"
  cat /tmp/ek-posta-settings-put.json 2>/dev/null || true
  exit 1
fi

grep -q '"ok":true' /tmp/ek-posta-settings-put.json && echo "OK   posta-mail-settings.json (.env → panel)" || {
  echo "HATA: ayar kaydı"
  cat /tmp/ek-posta-settings-put.json
  exit 1
}
