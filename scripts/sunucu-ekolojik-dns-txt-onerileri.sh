#!/usr/bin/env bash
# Önerilen SPF / DMARC / DKIM TXT — Turhost paneline kopyala (Faz 3 ops)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
DATA_DIR="${INSTALL_DIR}/data"
TENANT="${EKOLOJIK_VERIFY_TENANT:-main}"
SELECTOR="${EKOLOJIK_DKIM_SELECTOR:-ekolojik}"

# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${REPO_ROOT}/scripts/lib/ekolojik-env-load.sh"
# shellcheck source=scripts/lib/ekolojik-opendkim-dns-txt.sh
source "${REPO_ROOT}/scripts/lib/ekolojik-opendkim-dns-txt.sh"

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

VPS_IP="${EKOLOJIK_DNS_VPS_IP:-${EKOLOJIK_VPS_PUBLIC_IP:-}}"
if [[ -z "${VPS_IP}" ]] && command -v curl >/dev/null 2>&1; then
  VPS_IP="$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || true)"
fi
VPS_IP="${VPS_IP:-168.231.109.27}"

FROM="${EKOLOJIK_MAIL_FROM:-info@${DOMAIN}}"
DMARC_RUA="${EKOLOJIK_DMARC_RUA:-mailto:${FROM}}"
if [[ "${DMARC_RUA}" != mailto:* ]]; then
  DMARC_RUA="mailto:${DMARC_RUA#mailto:}"
fi
DMARC_TXT="v=DMARC1; p=quarantine; rua=${DMARC_RUA}; pct=100"
SPF_TXT="v=spf1 a mx ip4:${VPS_IP} ~all"

DKIM_TXT=""
DKIM_FILE="/etc/opendkim/keys/${DOMAIN}/${SELECTOR}.txt"
if [[ -f "${DKIM_FILE}" ]]; then
  DKIM_TXT="$(ekolojik_opendkim_txt_oneline "${DKIM_FILE}" || true)"
fi

echo "=== Ekolojik DNS TXT önerileri (Turhost) ==="
echo "Alan: ${DOMAIN} · selector: ${SELECTOR} · VPS: ${VPS_IP}"
echo "Panel rehberi: ${REPO_ROOT}/docs/EKOLOJIK-DNS-TURHOST-PANEL.md"
echo ""
echo "| Tür   | Turhost host | TXT değeri |"
echo "|-------|--------------|------------|"
echo "| SPF   | @            | ${SPF_TXT} |"
echo "| DMARC | _dmarc       | ${DMARC_TXT} |"
if [[ -n "${DKIM_TXT}" ]]; then
  echo "| DKIM  | ${SELECTOR}._domainkey | (tek satır, aşağıda) |"
else
  echo "| DKIM  | ${SELECTOR}._domainkey | (sunucuda anahtar yok — opendkim-kur.sh --apply) |"
fi
echo ""
echo "--- Kopyala-yapıştır (ham) ---"
echo "# SPF @"
echo "${SPF_TXT}"
echo ""
echo "# DMARC _dmarc.${DOMAIN}"
echo "${DMARC_TXT}"
echo ""
if [[ -n "${DKIM_TXT}" ]]; then
  echo "# DKIM ${SELECTOR}._domainkey.${DOMAIN}"
  echo "${DKIM_TXT}"
else
  echo "# DKIM — root: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-opendkim-kur.sh --apply"
fi
echo ""
echo "Doğrulama:"
echo "  EKOLOJIK_DNS_STRICT=0 bash ${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh"
echo "  EKOLOJIK_DNS_STRICT=1 bash ${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh"
echo "  EKOLOJIK_DNS_STRICT=1 bash ${REPO_ROOT}/scripts/sunucu-ekolojik-dns-strict-kapisi.sh"
