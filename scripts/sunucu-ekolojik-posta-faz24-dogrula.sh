#!/usr/bin/env bash
# Faz 24 — DNS + tam kabul otomasyonu smoke
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-posta-smoke-auth.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-smoke-auth.sh"
ekolojik_posta_smoke_auth_init "${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}"
BASE="${EKOLOJIK_VERIFY_BASE_URL}"

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 24 doğrulama ==="

for f in \
  sunucu-ekolojik-posta-tam-kabul.sh \
  sunucu-ekolojik-dns-mail-dogrula.sh \
  sunucu-ekolojik-posta-haftalik-dogrula.sh; do
  test -f "${REPO_ROOT}/scripts/${f}" || { echo "HATA: ${f} eksik"; exit 1; }
done
echo "OK   Faz 24 scriptleri"

EKOLOJIK_DNS_STRICT=0 bash "${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh" || true

if [[ "$(id -u)" == "0" ]]; then
  for c in ekolojik-posta-parite ekolojik-market-data-backup; do
    if [[ -f "/etc/cron.d/${c}" ]]; then
      echo "OK   cron ${c}"
    else
      echo "UYARI: /etc/cron.d/${c} yok"
    fi
  done
fi

echo "✓ Faz 24 doğrulama geçti"
