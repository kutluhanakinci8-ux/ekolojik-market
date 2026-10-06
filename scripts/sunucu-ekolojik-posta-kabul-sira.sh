#!/usr/bin/env bash
# Kabul sırası: Akış C (E2E) → Faz 5 otomatik → isteğe bağlı DNS / failed arşiv
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta kabul sırası ==="
echo "Runtime: ${INSTALL_DIR}"
echo ""

if [[ "${EKOLOJIK_SKIP_E2E:-0}" != "1" ]]; then
  echo "--- 1/4 Akış C (E2E tam) ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-e2e-tam.sh" "${INSTALL_DIR}"
else
  echo "--- 1/4 Akış C atlandı (EKOLOJIK_SKIP_E2E=1) ---"
fi
echo ""

echo "--- 2/4 Faz 5 prod otomatik ---"
export EKOLOJIK_RUN_E2E=0
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-faz5-prod-dogrula.sh" "${INSTALL_DIR}"
echo ""

if [[ "${EKOLOJIK_SKIP_OPS:-0}" != "1" ]]; then
  echo "--- 3/4 Faz 5 ops (yedek + cron + posta settings + DNS öneri) ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-faz5-ops-dogrula.sh" "${INSTALL_DIR}"
else
  echo "--- 3/4 Faz 5 ops atlandı (EKOLOJIK_SKIP_OPS=1) ---"
  if [[ "${EKOLOJIK_RUN_DNS:-0}" == "1" ]]; then
    bash "${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh"
  fi
fi
echo ""

if [[ "${EKOLOJIK_ARCHIVE_FAILED:-0}" == "1" ]]; then
  echo "--- Opsiyonel: failed outbox arşiv ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-outbox-failed-arsivle.sh" "${INSTALL_DIR}"
fi

echo "--- 4/4 Özet ---"
echo "Manuel: NB UI checklist + DNS panel (SPF/DKIM) — docs/EKOLOJIK-FAZ5-PROD-CHECKLIST.md"
echo "✓ Kabul sırası otomatik adımlar tamam"
