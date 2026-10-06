#!/usr/bin/env bash
# Kabul sırası: Akış C → Faz 5 → ops → DNS/DKIM → NB UI → özet
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta kabul sırası ==="
echo "Runtime: ${INSTALL_DIR}"
echo ""

if [[ "${EKOLOJIK_SKIP_E2E:-0}" != "1" ]]; then
  echo "--- 1/6 Akış C (E2E tam) ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-e2e-tam.sh" "${INSTALL_DIR}"
else
  echo "--- 1/6 Akış C atlandı (EKOLOJIK_SKIP_E2E=1) ---"
fi
echo ""

echo "--- 2/6 Faz 5 prod otomatik ---"
export EKOLOJIK_RUN_E2E=0
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-faz5-prod-dogrula.sh" "${INSTALL_DIR}"
echo ""

if [[ "${EKOLOJIK_SKIP_OPS:-0}" != "1" ]]; then
  echo "--- 3/6 Faz 5 ops (yedek + cron + posta settings) ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-faz5-ops-dogrula.sh" "${INSTALL_DIR}"
else
  echo "--- 3/6 Faz 5 ops atlandı (EKOLOJIK_SKIP_OPS=1) ---"
fi
echo ""

if [[ "${EKOLOJIK_SKIP_DNS:-0}" != "1" ]]; then
  echo "--- 4/6 DNS / DKIM kabul ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-dns-kabul-dogrula.sh"
else
  echo "--- 4/6 DNS atlandı (EKOLOJIK_SKIP_DNS=1) ---"
fi
echo ""

if [[ "${EKOLOJIK_ARCHIVE_FAILED:-0}" == "1" ]]; then
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-outbox-failed-arsivle.sh" "${INSTALL_DIR}"
  echo ""
fi

if [[ "${EKOLOJIK_SKIP_NB_UI:-0}" != "1" ]]; then
  echo "--- 5/6 NB UI yürüyüş + API ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-ui-yuruyus.sh" "${INSTALL_DIR}"
else
  echo "--- 5/6 NB atlandı — bash ${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-ui-yuruyus.sh"
fi
echo ""

echo "--- 6/6 Özet ---"
echo "DNS panel: SPF/DMARC/DKIM TXT yayınlandıktan sonra EKOLOJIK_DNS_STRICT=1 dns-mail-dogrula"
echo "Manuel UI: docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md"
echo "Bakım: /var/run/reboot-required varsa reboot"
echo "✓ Kabul sırası otomatik adımlar tamam"
