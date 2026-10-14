#!/usr/bin/env bash
# Platform destek — SLA özür maili cron (günlük 09:00 TR önerisi)
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
CRON_FILE="/etc/cron.d/ekolojik-support-sla-apology"
MARK="platform-support-sla-apology-cron.mjs"
LOG="/var/log/ekolojik-support-sla-apology.log"

if [[ "$(id -u)" != "0" ]]; then
  echo "UYARI: root değil — cron kurulmadı"
  exit 0
fi

cat >"${CRON_FILE}" <<EOF
# Ekolojik — SLA özür (EKOLOJIK_SUPPORT_SLA_AUTO_APOLOGY=1)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
0 6 * * * root MARKET_POS_DATA_DIR=${INSTALL_DIR}/data node ${REPO_ROOT}/scripts/${MARK} >> ${LOG} 2>&1
EOF
chmod 644 "${CRON_FILE}"
touch "${LOG}"
echo "OK   cron ${CRON_FILE} (06:00 UTC — TR 09:00)"
