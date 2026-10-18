#!/usr/bin/env bash
# Faz 5 — günlük data yedek cron (idempotent)
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
CRON_D="/etc/cron.d/ekolojik-market-data-backup"
LOG="/var/log/ekolojik-backup.log"
MARK="sunucu-ekolojik-data-yedek.sh"

if [[ "$(id -u)" != "0" ]]; then
  echo "HATA: root olarak çalıştırın (cron.d yazımı)"
  exit 1
fi

if [[ -f "${CRON_D}" ]] && grep -q "${MARK}" "${CRON_D}"; then
  echo "OK   cron zaten kayıtlı (${CRON_D})"
  exit 0
fi

cat >"${CRON_D}" <<EOF
# Ekolojik Market POS — günlük data yedek (Faz 5)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 3 * * * root bash ${REPO_ROOT}/scripts/${MARK} >> ${LOG} 2>&1
EOF
chmod 644 "${CRON_D}"
touch "${LOG}"
echo "OK   cron kuruldu: ${CRON_D} → ${LOG}"
