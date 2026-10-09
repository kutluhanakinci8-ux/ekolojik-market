#!/usr/bin/env bash
# Haftalık Posta parite sağlığı — Faz 22 kapısı (E2E hariç, hızlı)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
PORT="${PORT:-5180}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT}}"
LOG="${EKOLOJIK_POSTA_WEEKLY_LOG:-/var/log/ekolojik-posta-weekly.log}"

echo "=== $(date -Is) Posta haftalık doğrulama ===" | tee -a "${LOG}"

if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh" "${INSTALL_DIR}" >>"${LOG}" 2>&1; then
  echo "OK   Faz 22 kapısı" | tee -a "${LOG}"
else
  echo "FAIL Faz 22 — log: ${LOG}" | tee -a "${LOG}"
  exit 1
fi

echo "--- DNS (uyarı modu) ---" | tee -a "${LOG}"
if EKOLOJIK_DNS_STRICT=0 bash "${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh" >>"${LOG}" 2>&1; then
  echo "OK   DNS mail TXT (veya uyarı)" | tee -a "${LOG}"
else
  echo "UYARI: DNS doğrulama — panel SPF/DMARC/DKIM (strict: EKOLOJIK_DNS_STRICT=1)" | tee -a "${LOG}"
fi

for c in /etc/cron.d/ekolojik-posta-parite /etc/cron.d/ekolojik-market-data-backup /etc/cron.d/ekolojik-outbox-failed-archive; do
  if [[ -f "${c}" ]]; then
    echo "OK   cron $(basename "${c}")" | tee -a "${LOG}"
  else
    echo "UYARI: cron eksik ${c}" | tee -a "${LOG}"
  fi
done
