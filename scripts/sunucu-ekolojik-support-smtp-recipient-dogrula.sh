#!/usr/bin/env bash
# Yerel Postfix relay: destek@ (ve opsiyonel EKOLOJIK_SUPPORT_INBOX) kabul ediliyor mu?
# Kök neden: mağaza outbox / platform bildirimleri destek@ adresine gider; virtual alias yoksa 550.
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${INSTALL_DIR}/.env"
VIRTUAL_FILE="/etc/postfix/ekolojik-inbound-virtual-destek"
DOMAIN="${EKOLOJIK_MAIL_DOMAIN:-ekolojikmarket.com.tr}"
DEFAULT_DESTEK="destek@${DOMAIN}"

# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${REPO_ROOT}/scripts/lib/ekolojik-env-load.sh"
set -a
ekolojik_load_env "${ENV_FILE}"
set +a

DESTEK="${EKOLOJIK_SUPPORT_INBOX:-${DEFAULT_DESTEK}}"
HOST="${EKOLOJIK_SMTP_HOST:-}"

echo "=== Ekolojik SMTP destek@ alıcı doğrulama ==="
echo "SMTP host: ${HOST:-—}"
echo "Destek:    ${DESTEK}"

if [[ -z "${DESTEK}" || ! "${DESTEK}" == *@* ]]; then
  echo "UYARI: destek adresi tanımlı değil"
  exit 0
fi

if [[ "${HOST}" != "127.0.0.1" && "${HOST}" != "localhost" && "${HOST}" != "::1" && -n "${HOST}" ]]; then
  echo "OK   uzak SMTP — yerel Postfix alias kontrolü atlandı"
  exit 0
fi

FAIL=0
if [[ "$(id -u)" != "0" ]]; then
  echo "UYARI: root değil — düzeltme: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-destek-mailbox.sh --apply"
  exit 0
fi

VA="$(postconf -h virtual_alias_maps 2>/dev/null || true)"
if [[ "${VA}" != *ekolojik-inbound-virtual-destek* ]]; then
  echo "HATA: virtual_alias_maps içinde ekolojik-inbound-virtual-destek yok"
  echo "      Mevcut: ${VA:-boş}"
  echo "      Düzelt: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-destek-mailbox.sh --apply"
  FAIL=1
else
  echo "OK   virtual_alias_maps → ekolojik-inbound-virtual-destek"
fi

VD="$(postconf -h virtual_alias_domains 2>/dev/null || true)"
if [[ "${VD}" != *"${DOMAIN}"* ]]; then
  echo "HATA: virtual_alias_domains içinde ${DOMAIN} yok (giden relay 550 riski)"
  echo "      Mevcut: ${VD:-boş}"
  echo "      Düzelt: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-destek-mailbox.sh --apply"
  FAIL=1
else
  echo "OK   virtual_alias_domains → ${DOMAIN}"
fi

if [[ -f "${VIRTUAL_FILE}" ]]; then
  RES="$(postmap -q "${DESTEK}" "hash:${VIRTUAL_FILE}" 2>/dev/null || true)"
  if [[ -n "${RES}" ]]; then
    echo "OK   postmap ${DESTEK} → ${RES}"
  else
    echo "HATA: ${VIRTUAL_FILE} içinde ${DESTEK} yok"
    FAIL=1
  fi
else
  echo "HATA: ${VIRTUAL_FILE} bulunamadı — destek-mailbox --apply"
  FAIL=1
fi

if command -v sendmail >/dev/null 2>&1; then
  OUT="$(sendmail -bv "${DESTEK}" 2>&1 || true)"
  if grep -qiE 'unknown|reject|unavailable|undeliverable|550' <<<"${OUT}"; then
    echo "HATA: sendmail -bv ${DESTEK}"
    echo "      ${OUT}" | head -4
    FAIL=1
  elif grep -qiE 'deliverable|mailer|virtual|pipe'; then
    echo "OK   sendmail -bv ${DESTEK}"
  else
    echo "OK   sendmail -bv (muhtemel teslim)"
  fi
fi

if [[ "${FAIL}" -ne 0 ]]; then
  echo ""
  echo "Örnek hata: 550 Recipient address rejected: User unknown in virtual alias lookup"
  echo "Çözüm: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-destek-mailbox.sh --apply"
  exit 1
fi

echo ""
echo "✓ destek@ yerel relay ile uyumlu"
exit 0
