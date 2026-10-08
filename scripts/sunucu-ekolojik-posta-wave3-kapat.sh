#!/usr/bin/env bash
# Wave 3 resmi kapanış — Faz 38–52 (merge / prod öncesi tek kapı)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
PORT="${PORT:-5180}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT}}"

echo "=== Ekolojik Posta Wave 3 kapanış (Faz 38–52) ==="
echo "Repo:    ${REPO_ROOT}"
echo "Runtime: ${INSTALL_DIR}"
echo ""

FAIL=0
run() {
  if bash "$@"; then echo ""; else FAIL=1; fi
}

cd "${REPO_ROOT}"

echo "--- Plan & artefakt ---"
run node scripts/faz52-closure-smoke.mjs

echo "--- Wave 3 doğrulama ---"
run "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-wave3-dogrula.sh" "${INSTALL_DIR}"

if [[ "${EKOLOJIK_INCLUDE_WAVE2_GATE:-1}" == "1" ]]; then
  echo "--- Wave 2 gerileme kapısı ---"
  run "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-wave2-kapat.sh" "${INSTALL_DIR}"
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "✓ Wave 3 kapanış kapısı geçti"
  echo "  Skor: docs/RAKIP-SKOR-KARTI.md"
  echo "  Merge: docs/PLAN-POSTA-WAVE3-KAPATMA.md"
  exit 0
fi
echo "✗ Wave 3 kapanış — yukarıdaki hataları giderin"
exit 1
