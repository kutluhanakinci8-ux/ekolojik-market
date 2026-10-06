#!/usr/bin/env bash
# Akış C — tam Posta E2E (parite + SMTP/IMAP + Gelen + Akış A/B + NB API)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
PORT="${PORT:-5180}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT}}"

echo "=== Ekolojik Posta E2E tam (Akış C) ==="
echo "Runtime: ${INSTALL_DIR}"
echo "API:     ${EKOLOJIK_VERIFY_BASE_URL}"
echo ""

bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-parite-dogrula.sh" "${INSTALL_DIR}"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-smtp-dogrula.sh" "${INSTALL_DIR}"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-imap-dogrula.sh" "${INSTALL_DIR}"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-gelen-smoke.sh" "${INSTALL_DIR}"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-akis-a-smoke.sh" "${INSTALL_DIR}"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-akis-b-smoke.sh" "${INSTALL_DIR}"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-checklist-dogrula.sh" "${INSTALL_DIR}"

echo ""
echo "✓ Akış C — tüm E2E smoke geçti"
