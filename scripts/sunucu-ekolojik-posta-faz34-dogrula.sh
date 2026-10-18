#!/usr/bin/env bash
# Faz 34 — Wave 2 parite kapanış scripti
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 34 doğrulama ==="
test -x "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-wave2-kapat.sh" || exit 1
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-wave2-kapat.sh" "${INSTALL_DIR}"
echo "✓ Faz 34 doğrulama geçti"
