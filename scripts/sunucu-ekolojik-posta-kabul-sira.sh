#!/usr/bin/env bash
# Kabul sırası: Akış C → Faz 5 → ops → DNS/DKIM → NB UI → özet
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta kabul sırası (Faz 22 güncel) ==="
echo "Runtime: ${INSTALL_DIR}"
echo ""

if [[ "${EKOLOJIK_SKIP_E2E:-0}" != "1" ]]; then
  echo "--- 1/7 Akış C (E2E tam) ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-e2e-tam.sh" "${INSTALL_DIR}"
else
  echo "--- 1/7 Akış C atlandı (EKOLOJIK_SKIP_E2E=1) ---"
fi
echo ""

echo "--- 2/7 Faz 5 prod otomatik ---"
export EKOLOJIK_RUN_E2E=0
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-faz5-prod-dogrula.sh" "${INSTALL_DIR}"
echo ""

if [[ "${EKOLOJIK_SKIP_OPS:-0}" != "1" ]]; then
  echo "--- 3/7 Faz 5 ops (yedek + cron + posta settings) ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-faz5-ops-dogrula.sh" "${INSTALL_DIR}"
else
  echo "--- 3/7 Faz 5 ops atlandı (EKOLOJIK_SKIP_OPS=1) ---"
fi
echo ""

if [[ "${EKOLOJIK_SKIP_DNS:-0}" != "1" ]]; then
  echo "--- 4/7 DNS / DKIM kabul ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-dns-kabul-dogrula.sh"
else
  echo "--- 4/7 DNS atlandı (EKOLOJIK_SKIP_DNS=1) ---"
fi
echo ""

if [[ "${EKOLOJIK_ARCHIVE_FAILED:-0}" == "1" ]]; then
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-outbox-failed-arsivle.sh" "${INSTALL_DIR}"
  echo ""
fi

if [[ "${EKOLOJIK_SKIP_NB_UI:-0}" != "1" ]]; then
  echo "--- 5/7 NB UI yürüyüş + API ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-ui-yuruyus.sh" "${INSTALL_DIR}"
else
  echo "--- 5/7 NB atlandı — bash ${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-ui-yuruyus.sh"
fi
echo ""

if [[ "${EKOLOJIK_SKIP_FAZ22:-0}" != "1" ]]; then
  echo "--- 6/7 Tam parite kapısı (Faz 22) ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh" "${INSTALL_DIR}"
else
  echo "--- 6/7 Faz 22 atlandı (EKOLOJIK_SKIP_FAZ22=1) ---"
fi
echo ""

echo "--- 7/7 Özet ---"
echo "Kod statik: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-kod-parite-dogrula.sh"
echo "DNS panel: SPF/DMARC/DKIM TXT yayınlandıktan sonra EKOLOJIK_DNS_STRICT=1 dns-mail-dogrula"
echo "Manuel UI: docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md"
echo "Operatör: docs/EKOLOJIK-POSTA-KULLANIM.md"
echo "Tam kapı: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh ${INSTALL_DIR}"
echo "Bakım: /var/run/reboot-required varsa reboot"
echo "✓ Kabul sırası otomatik adımlar tamam"
