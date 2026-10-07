#!/usr/bin/env bash
# Wave 2 kapanış — Faz 25–33 + NB gap (P1–P3 lite)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
PORT="${PORT:-5180}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT}}"

echo "=== Ekolojik Posta Wave 2 kapanış ==="
FAIL=0
run() {
  if bash "$@"; then echo ""; else FAIL=1; fi
}

run "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-parite-dogrula.sh" "${INSTALL_DIR}"

for n in 25 26 27 28 29 30 31 32 33; do
  script="${REPO_ROOT}/scripts/sunucu-ekolojik-posta-faz${n}-dogrula.sh"
  if [[ -f "${script}" ]]; then
    echo "--- Faz ${n} ---"
    run "${script}"
  fi
done

run "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-gap-dogrula.sh"
run "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh" "${INSTALL_DIR}"

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "✓ Wave 2 + NB gap kapısı geçti"
  echo "  Plan: docs/PLAN-EKOLOJIK-POSTA-NB-WAVE2.md"
  exit 0
fi
echo "✗ Wave 2 kapanış — yukarıdaki hataları giderin"
exit 1
