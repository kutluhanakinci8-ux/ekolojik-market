#!/usr/bin/env bash
# Haftalık Posta Faz 22 doğrulama cron (Pazartesi 05:30 UTC)
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
CRON_D="/etc/cron.d/ekolojik-posta-parite"
LOG="/var/log/ekolojik-posta-weekly.log"
MARK="sunucu-ekolojik-posta-haftalik-dogrula.sh"

if [[ "$(id -u)" != "0" ]]; then
  echo "HATA: root olarak çalıştırın"
  exit 1
fi

if [[ -f "${CRON_D}" ]] && grep -q "${MARK}" "${CRON_D}"; then
  echo "OK   cron zaten kayıtlı (${CRON_D})"
  exit 0
fi

cat >"${CRON_D}" <<EOF
# Ekolojik Posta — haftalık Faz 22 parite (Faz 23 ops)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
EKOLOJIK_REPO_ROOT=${REPO_ROOT}
MARKET_POS_DIR=${INSTALL_DIR}
30 5 * * 1 root bash ${REPO_ROOT}/scripts/${MARK} ${INSTALL_DIR} >> ${LOG} 2>&1
EOF
chmod 644 "${CRON_D}"
touch "${LOG}"
echo "OK   cron kuruldu: ${CRON_D} → ${LOG}"
