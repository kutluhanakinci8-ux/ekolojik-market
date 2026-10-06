#!/usr/bin/env bash
# Faz 5 / Faz 6 — Ekolojik .env denetimi (NB karışımı, SMTP host, zorunlu anahtarlar)
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
ENV_FILE="${ROOT}/.env"
FAIL=0

warn() { echo "UYARI: $*"; }
ok() { echo "OK   $*"; }
bad() { echo "HATA: $*"; FAIL=1; }

echo "=== Ekolojik env audit ==="
echo "Dosya: ${ENV_FILE}"

if [[ ! -f "${ENV_FILE}" ]]; then
  bad "${ENV_FILE} yok — scripts/sunucu-ekolojik-env-kur.sh"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${SCRIPT_DIR}/lib/ekolojik-env-load.sh"

# shellcheck disable=SC1090
set -a
ekolojik_load_env "${ENV_FILE}"
set +a

if [[ "${LERTA_PLATFORM_BRIDGE:-0}" == "0" ]]; then
  ok "LERTA_PLATFORM_BRIDGE=0"
else
  bad "LERTA_PLATFORM_BRIDGE=${LERTA_PLATFORM_BRIDGE:-} — üretimde 0 olmalı"
fi

if [[ -n "${LERTA_MAIL_API_KEY:-}" || -n "${LERTA_PLATFORM_API_URL:-}" ]]; then
  warn "LERTA_PLATFORM_* tanımlı — bilinçli test dışında kaldırın"
fi

if [[ -n "${MAIL_PLATFORM_SMTP_HOST:-}" || -n "${MAIL_PLATFORM_FROM:-}" ]]; then
  bad "MAIL_PLATFORM_* bu VPS'te olmamalı (Nakliye Borsası env karışımı)"
fi

HOST="${EKOLOJIK_SMTP_HOST:-}"
FROM="${EKOLOJIK_MAIL_FROM:-}"
OPS="${EKOLOJIK_OPS_EMAIL:-}"

if [[ -z "${HOST}" || -z "${FROM}" ]]; then
  bad "EKOLOJIK_SMTP_HOST ve EKOLOJIK_MAIL_FROM zorunlu (Faz 6)"
else
  ok "SMTP host + From tanımlı"
fi

if [[ "${HOST}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  bad "EKOLOJIK_SMTP_HOST VPS IP (${HOST}) — mail.ekolojikmarket.com.tr veya relay kullanın"
elif [[ "${HOST}" == "localhost" || "${HOST}" == "127.0.0.1" ]]; then
  warn "SMTP host localhost — üretimde mail subdomain önerilir"
else
  ok "SMTP host hostname (${HOST})"
fi

if [[ "${OPS}" == *"@"* ]]; then
  ok "EKOLOJIK_OPS_EMAIL=${OPS}"
else
  warn "EKOLOJIK_OPS_EMAIL eksik — iletişim/mesaj bildirimleri atlanır"
fi

if [[ "${PORT:-5180}" == "5180" ]]; then
  ok "PORT=5180 (NB ile ayrı process)"
else
  ok "PORT=${PORT:-?}"
fi

if pm2 describe market-pos >/dev/null 2>&1; then
  ok "pm2 market-pos kayıtlı"
else
  warn "pm2 market-pos bulunamadı"
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "✓ Env audit geçti"
  exit 0
fi
echo "✗ Env audit — .env düzenleyin, pm2 restart market-pos --update-env"
exit 1
