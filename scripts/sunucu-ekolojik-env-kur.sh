#!/usr/bin/env bash
# Ekolojik Market POS — /var/www/market-pos/.env (Faz 1 SMTP, ops, IMAP)
#   bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-env-kur.sh
set -euo pipefail

INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
REPO_ROOT="${REPO_ROOT:-/var/www/ekolojik-market-pos}"
ENV_FILE="${INSTALL_DIR}/.env"
EXAMPLE="${REPO_ROOT}/.env.example"

if [[ ! -f "${EXAMPLE}" ]]; then
  echo "HATA: ${EXAMPLE} yok — önce git pull" >&2
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  echo "==> Mevcut ${ENV_FILE} korunuyor (üzerine yazılmadı)"
else
  cp "${EXAMPLE}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"
  echo "==> ${ENV_FILE} oluşturuldu (.env.example kopyası)"
fi

# Üretim güvenli varsayılanlar (yalnızca anahtar yoksa)
ensure_kv() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" "${ENV_FILE}" 2>/dev/null; then
    return 0
  fi
  echo "${key}=${val}" >> "${ENV_FILE}"
}

ensure_kv LERTA_PLATFORM_BRIDGE 0
ensure_kv PORT 5180

echo ""
echo "Düzenleyin: nano ${ENV_FILE}"
echo "  EKOLOJIK_SMTP_HOST, EKOLOJIK_MAIL_FROM, EKOLOJIK_OPS_EMAIL"
echo "  (Faz 4) EKOLOJIK_IMAP_* veya POS ayarlarından IMAP"
echo ""
echo "Sonra: pm2 restart market-pos --update-env"
echo "Kontrol: curl -s http://127.0.0.1:5180/api/email/health | head -c 200"
