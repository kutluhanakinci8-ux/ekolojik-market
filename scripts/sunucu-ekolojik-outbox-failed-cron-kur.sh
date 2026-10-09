#!/usr/bin/env bash
# Faz 39 — haftalık failed outbox arşiv cron (Pazar 04:30 UTC)
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
CRON_D="/etc/cron.d/ekolojik-outbox-failed-archive"
LOG="/var/log/ekolojik-outbox-archive.log"
MARK="sunucu-ekolojik-outbox-failed-arsivle.sh"

if [[ "$(id -u)" != "0" ]]; then
  echo "HATA: root olarak çalıştırın (cron.d yazımı)"
  exit 1
fi

if [[ -f "${CRON_D}" ]] && grep -q "${MARK}" "${CRON_D}"; then
  echo "OK   cron zaten kayıtlı (${CRON_D})"
  exit 0
fi

cat >"${CRON_D}" <<EOF
# Ekolojik Market POS — failed outbox arşiv (Faz 39)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
30 4 * * 0 root EKOLOJIK_DRY_RUN=0 bash ${REPO_ROOT}/scripts/${MARK} ${INSTALL_DIR} >> ${LOG} 2>&1
EOF
chmod 644 "${CRON_D}"
touch "${LOG}"
echo "OK   cron kuruldu: ${CRON_D} → ${LOG}"
