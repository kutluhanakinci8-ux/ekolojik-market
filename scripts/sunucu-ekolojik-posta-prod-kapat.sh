#!/usr/bin/env bash
# Posta Faz 12 sonrası — prod kapatma kapısı (env + parite + yedek hatırlatması)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
PORT="${PORT:-5180}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT}}"

echo "=== Ekolojik Posta prod kapatma ==="
echo "Runtime: ${INSTALL_DIR}"
echo "Repo:    ${REPO_ROOT}"
echo ""

FAIL=0
if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-env-audit.sh" "${INSTALL_DIR}"; then
  :
else
  FAIL=1
fi
echo ""

if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-parite-dogrula.sh" "${INSTALL_DIR}"; then
  :
else
  FAIL=1
fi

echo ""
if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-imap-dogrula.sh" "${INSTALL_DIR}"; then
  echo "OK   IMAP (Faz 7 Gelen)"
else
  echo "UYARI: IMAP — docs/EKOLOJIK-FAZ7-IMAP-RUNBOOK.md"
fi

echo ""
echo "Yedek (günlük cron önerisi):"
echo "  bash ${REPO_ROOT}/scripts/sunucu-ekolojik-data-yedek.sh"
echo "Rehber: docs/EKOLOJIK-POSTA-PROD-KAPATMA.md"
echo ""

if [[ "${EKOLOJIK_E2E_SMOKE:-0}" == "1" ]]; then
  echo ""
  echo "=== E2E smoke (EKOLOJIK_E2E_SMOKE=1) ==="
  if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-e2e-tam.sh" "${INSTALL_DIR}"; then
    echo "OK   E2E Akış C"
  else
    FAIL=1
  fi
  echo ""
fi

if [[ $FAIL -eq 0 ]]; then
  echo "✓ Prod kapatma kapısı — posta/mesaj canlıya hazır (SMTP/IMAP sizin altyapınız)"
  exit 0
fi
exit 1
