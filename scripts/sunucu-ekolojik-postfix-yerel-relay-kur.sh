#!/usr/bin/env bash
# Faz 6 — Aynı VPS'te Postfix yerel relay (ECONNREFUSED :587 önleme)
# market-pos → 127.0.0.1:25 (mynetworks); dış dünya için DNS/SPF ayrıca sizin
#
# Kullanım (root, VPS):
#   bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-postfix-yerel-relay-kur.sh
#   bash .../sunucu-ekolojik-postfix-yerel-relay-kur.sh --apply
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
ENV_FILE="${INSTALL_DIR}/.env"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${SCRIPT_DIR}/lib/ekolojik-env-load.sh"

set_env_kv() {
  local key="$1"
  local val="$2"
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "HATA: ${ENV_FILE} yok"
    exit 1
  fi
  if grep -qE "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

echo "=== Ekolojik Faz 6 — Postfix yerel relay ==="
echo "Runtime: ${INSTALL_DIR}"
echo "Repo:    ${REPO_ROOT}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "HATA: ${ENV_FILE} yok — önce sunucu-ekolojik-env-kur.sh"
  exit 1
fi

if ! command -v postconf >/dev/null 2>&1; then
  echo "HATA: Postfix yok — apt install postfix"
  exit 1
fi

systemctl is-active postfix >/dev/null 2>&1 || systemctl start postfix
systemctl enable postfix >/dev/null 2>&1 || true

if ! ss -tln | grep -q ':25 '; then
  echo "HATA: Postfix 25 dinlemiyor — journalctl -u postfix"
  exit 1
fi
echo "OK   Postfix 25 dinliyor"

ekolojik_load_env "${ENV_FILE}"
OLD_HOST="${EKOLOJIK_SMTP_HOST:-}"
OLD_PORT="${EKOLOJIK_SMTP_PORT:-587}"

echo ""
echo "Mevcut: EKOLOJIK_SMTP_HOST=${OLD_HOST} PORT=${OLD_PORT}"
echo "Öneri:  EKOLOJIK_SMTP_HOST=127.0.0.1 PORT=25 (aynı VPS, mynetworks)"
echo "Not:    mail.ekolojikmarket.com.tr → bu sunucu IP ise :587 genelde kapalıdır."
echo ""

if [[ "${APPLY}" -ne 1 ]]; then
  echo "Dry-run. Uygulamak için:"
  echo "  bash ${REPO_ROOT}/scripts/sunucu-ekolojik-postfix-yerel-relay-kur.sh --apply"
  exit 0
fi

cp -a "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d%H%M%S)"
set_env_kv EKOLOJIK_SMTP_HOST 127.0.0.1
set_env_kv EKOLOJIK_SMTP_PORT 25
set_env_kv EKOLOJIK_SMTP_SECURE 0
if grep -qE '^EKOLOJIK_SMTP_USER=' "${ENV_FILE}"; then
  sed -i 's|^EKOLOJIK_SMTP_USER=.*|EKOLOJIK_SMTP_USER=|' "${ENV_FILE}"
fi
if grep -qE '^EKOLOJIK_SMTP_PASS=' "${ENV_FILE}"; then
  sed -i 's|^EKOLOJIK_SMTP_PASS=.*|EKOLOJIK_SMTP_PASS=|' "${ENV_FILE}"
fi

echo "OK   .env güncellendi (yedek alındı)"

if command -v pm2 >/dev/null 2>&1; then
  pm2 delete market-pos 2>/dev/null || true
  (cd "${INSTALL_DIR}" && pm2 start ecosystem.config.cjs --update-env)
  pm2 save >/dev/null 2>&1 || true
  echo "OK   pm2 market-pos yeniden başlatıldı (.env yüklendi)"
fi

sleep 2
export EKOLOJIK_REPO_ROOT="${REPO_ROOT}"
if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-smtp-dogrula.sh" "${INSTALL_DIR}"; then
  echo ""
  echo "✓ SMTP yerel relay hazır — test maili Ayarlar → E-posta"
else
  echo ""
  echo "UYARI: SMTP doğrulama hâlâ kırmızı — postconf, firewall, From domain SPF"
  exit 2
fi
