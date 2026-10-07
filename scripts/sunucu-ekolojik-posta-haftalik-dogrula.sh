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
