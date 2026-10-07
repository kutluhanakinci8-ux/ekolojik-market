#!/usr/bin/env bash
# Faz 22 — tam parite kapısı: Faz 12 + 14–21 doğrulama + E2E smoke
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
PORT="${PORT:-5180}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT}}"

echo "=== Ekolojik Posta Faz 22 — tam parite kapısı ==="
echo "Runtime: ${INSTALL_DIR}"
echo "API:     ${EKOLOJIK_VERIFY_BASE_URL}"
echo ""

FAIL=0
run() {
  if bash "$@"; then
    echo ""
  else
    FAIL=1
  fi
}

run "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-parite-dogrula.sh" "${INSTALL_DIR}"
run "${REPO_ROOT}/scripts/sunucu-ekolojik-imap-klasor-dogrula.sh"

for n in 15 16 17 18 19 20 21 25 26 27; do
  script="${REPO_ROOT}/scripts/sunucu-ekolojik-posta-faz${n}-dogrula.sh"
  if [[ -f "${script}" ]]; then
    echo "--- Faz ${n} ---"
    run "${script}"
  fi
done

run "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-faz22-e2e-smoke.sh"
run "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-checklist-dogrula.sh" "${INSTALL_DIR}"

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "✓ Faz 22 tam parite kapısı geçti"
  echo "  Checklist: docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md"
  echo "  Operatör: docs/EKOLOJIK-POSTA-KULLANIM.md"
  exit 0
fi
echo "✗ Faz 22 kapısı — yukarıdaki hataları giderin"
exit 1
