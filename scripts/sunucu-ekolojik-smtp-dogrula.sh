#!/usr/bin/env bash
# Faz 6 — Ekolojik SMTP doğrulama (VPS / deploy sonrası)
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
ENV_FILE="${ROOT}/.env"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"

echo "=== Ekolojik SMTP doğrulama ==="
echo "Kök: ${ROOT}"
echo "API:  ${BASE_URL}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "HATA: ${ENV_FILE} yok — scripts/sunucu-ekolojik-env-kur.sh veya manuel .env oluşturun"
  exit 1
fi

# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}/scripts/lib/ekolojik-env-load.sh"

# shellcheck disable=SC1090
set -a
ekolojik_load_env "${ENV_FILE}"
set +a

HOST="${EKOLOJIK_SMTP_HOST:-}"
FROM="${EKOLOJIK_MAIL_FROM:-}"

if [[ -z "${HOST}" || -z "${FROM}" ]]; then
  echo "HATA: EKOLOJIK_SMTP_HOST ve EKOLOJIK_MAIL_FROM zorunlu"
  exit 1
fi

if [[ "${HOST}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  if [[ "${HOST}" == "127.0.0.1" ]]; then
    echo "OK: SMTP yerel relay (${HOST}:${EKOLOJIK_SMTP_PORT:-25})"
  else
    echo "UYARI: SMTP host VPS IP (${HOST}) — Postfix 587 dinlemiyorsa ECONNREFUSED alırsınız."
    echo "       Öneri: EKOLOJIK_SMTP_HOST=127.0.0.1:25 veya mail.ekolojikmarket.com.tr relay"
  fi
fi

HEALTH="$(curl -fsS "${BASE_URL}/api/email/health" 2>/dev/null || true)"
if [[ -z "${HEALTH}" ]]; then
  echo "HATA: ${BASE_URL}/api/email/health yanıt vermedi — pm2 / PORT kontrol edin"
  exit 1
fi

echo "${HEALTH}" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('smtpConfigured:', j.smtpConfigured);
console.log('smtpVerified:  ', j.smtpVerified);
console.log('smtpHost:      ', j.smtpHost);
if (j.smtpHostHint) console.log('hint:          ', j.smtpHostHint);
if (j.smtpError) console.log('smtpError:     ', j.smtpError);
process.exit(j.smtpVerified ? 0 : 2);
"
