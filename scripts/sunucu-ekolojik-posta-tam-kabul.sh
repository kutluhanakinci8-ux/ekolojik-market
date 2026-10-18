#!/usr/bin/env bash
# Tam kabul — E2E atlanmış, Faz 5 + ops + DNS + NB API + Faz 22 (VPS tek komut)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
PORT="${PORT:-5180}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT}}"

echo "=== Ekolojik Posta tam kabul (E2E atlanmış) ==="
echo "Runtime: ${INSTALL_DIR}"
echo ""

export EKOLOJIK_SKIP_E2E=1
export EKOLOJIK_SKIP_DNS="${EKOLOJIK_SKIP_DNS:-0}"
export EKOLOJIK_SKIP_OPS="${EKOLOJIK_SKIP_OPS:-0}"
export EKOLOJIK_SKIP_NB_UI="${EKOLOJIK_SKIP_NB_UI:-0}"
export EKOLOJIK_SKIP_FAZ22=0

bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-kabul-sira.sh" "${INSTALL_DIR}"

echo ""
if [[ "${EKOLOJIK_DNS_STRICT:-0}" == "1" ]]; then
  echo "--- DNS strict ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh"
fi

echo ""
echo "✓ Tam kabul tamamlandı"
