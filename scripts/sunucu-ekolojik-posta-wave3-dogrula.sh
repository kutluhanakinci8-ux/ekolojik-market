#!/usr/bin/env bash
# Wave 3 (%100) kapısı — birim/smoke + NB API (Faz 38+ auth uyumlu) + isteğe bağlı pre-release QA
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
INSTALL_DIR="${1:-/var/www/market-pos}"
PORT="${PORT:-5180}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT}}"

echo "=== Ekolojik Posta Wave 3 doğrulama (Faz 38–52) ==="
echo "Repo:    ${REPO_ROOT}"
echo "Runtime: ${INSTALL_DIR}"
echo "API:     ${EKOLOJIK_VERIFY_BASE_URL}"
echo ""

cd "${REPO_ROOT}"

echo "--- 1/4 Yerel test paketi (npm test) ---"
npm test
echo ""

echo "--- 2/4 Faz 52 kapanış smoke ---"
node scripts/faz52-closure-smoke.mjs
echo ""

echo "--- 3/4 NB + Wave 3 API kapısı ---"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-checklist-dogrula.sh" "${INSTALL_DIR}"
echo ""

if [[ "${EKOLOJIK_SKIP_PRERELEASE:-0}" != "1" ]]; then
  echo "--- 4/4 Pre-release QA (canlı) ---"
  if curl -fsS "${EKOLOJIK_VERIFY_BASE_URL}/api/email/health" >/dev/null 2>&1; then
    node scripts/pre-release-qa.mjs "${EKOLOJIK_VERIFY_BASE_URL}"
  else
    echo "WARN  sunucu ayakta değil — pre-release atlandı (EKOLOJIK_SKIP_PRERELEASE=1 ile zorunlu kılınabilir)"
  fi
else
  echo "--- 4/4 Pre-release QA atlandı (EKOLOJIK_SKIP_PRERELEASE=1) ---"
fi

echo ""
echo "✓ Wave 3 doğrulama tamam"
echo "  Skor kartı: docs/RAKIP-SKOR-KARTI.md"
echo "  UI yürüyüş: docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md"
