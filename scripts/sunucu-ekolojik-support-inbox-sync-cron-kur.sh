#!/usr/bin/env bash
# Platform destek@ — IMAP/outbox gelen kutusu senkron cron (5 dk)
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
CRON_D="/etc/cron.d/ekolojik-support-inbox-sync"
LOG="/var/log/ekolojik-support-inbox-sync.log"
MARK="platform-support-inbox-sync.mjs"

if [[ "$(id -u)" != "0" ]]; then
  echo "HATA: root olarak çalıştırın (cron.d yazımı)"
  exit 1
fi

if [[ -f "${CRON_D}" ]] && grep -q "${MARK}" "${CRON_D}"; then
  echo "OK   cron zaten kayıtlı (${CRON_D})"
  exit 0
fi

cat >"${CRON_D}" <<EOF
# Ekolojik Market POS — destek@ gelen kutusu senkron
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
*/5 * * * * root MARKET_POS_DATA_DIR=${INSTALL_DIR}/data node ${REPO_ROOT}/scripts/${MARK} >> ${LOG} 2>&1
EOF
chmod 644 "${CRON_D}"
touch "${LOG}"
echo "OK   cron kuruldu: ${CRON_D} → ${LOG}"
