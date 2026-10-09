#!/usr/bin/env bash
# Önerilen SPF / DMARC / DKIM TXT — domain paneline kopyala (Faz 3 ops)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
DATA_DIR="${INSTALL_DIR}/data"
TENANT="${EKOLOJIK_VERIFY_TENANT:-main}"

# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${REPO_ROOT}/scripts/lib/ekolojik-env-load.sh"
if [[ -f "${INSTALL_DIR}/.env" ]]; then
  set -a
  ekolojik_load_env "${INSTALL_DIR}/.env"
  set +a
fi

DOMAIN="${EKOLOJIK_MAIL_DOMAIN:-}"
if [[ -z "${DOMAIN}" && -f "${REPO_ROOT}/scripts/lib/ekolojik-tenant-mail-domain.mjs" ]]; then
  DOMAIN="$(node "${REPO_ROOT}/scripts/lib/ekolojik-tenant-mail-domain.mjs" "${DATA_DIR}" "${TENANT}" 2>/dev/null || true)"
fi
DOMAIN="${DOMAIN:-ekolojikmarket.com.tr}"

VPS_IP="${EKOLOJIK_DNS_VPS_IP:-}"
if [[ -z "${VPS_IP}" ]] && command -v curl >/dev/null 2>&1; then
  VPS_IP="$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || true)"
fi
VPS_IP="${VPS_IP:-YOUR_VPS_IP}"

FROM="${EKOLOJIK_MAIL_FROM:-info@${DOMAIN}}"

echo "=== Ekolojik DNS TXT önerileri ==="
echo "Alan: ${DOMAIN}"
echo "From: ${FROM}"
echo ""
echo "# SPF (@ veya kök TXT)"
echo "v=spf1 a mx ip4:${VPS_IP} ~all"
echo ""
echo "# DMARC"
echo "_dmarc.${DOMAIN} TXT:"
echo "v=DMARC1; p=quarantine; rua=mailto:${FROM}; pct=100"
echo ""
echo "# DKIM (selector hosting panelinizde — örnek)"
echo "default._domainkey.${DOMAIN} TXT:"
echo "(OpenDKIM / panelden üretilen public key — scripts/sunucu-ekolojik-opendkim-kur.sh)"
echo ""
echo "Doğrulama:"
echo "  EKOLOJIK_DNS_STRICT=0 bash ${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh"
echo "  EKOLOJIK_DNS_STRICT=1 bash ${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh"
