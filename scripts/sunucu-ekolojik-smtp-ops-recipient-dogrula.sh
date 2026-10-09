#!/usr/bin/env bash
# Yerel Postfix relay: ops bildirim alıcısı (EKOLOJIK_OPS_EMAIL) kabul ediliyor mu?
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
ENV_FILE="${INSTALL_DIR}/.env"
VIRTUAL_FILE="/etc/postfix/ekolojik-inbound-virtual"
DOMAIN="${EKOLOJIK_MAIL_DOMAIN:-ekolojikmarket.com.tr}"

# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${REPO_ROOT}/scripts/lib/ekolojik-env-load.sh"
set -a
ekolojik_load_env "${ENV_FILE}"
set +a

OPS="${EKOLOJIK_OPS_EMAIL:-}"
HOST="${EKOLOJIK_SMTP_HOST:-}"

echo "=== Ekolojik SMTP ops alıcı doğrulama ==="
echo "SMTP host: ${HOST:-—}"
echo "Ops:       ${OPS:-—}"

if [[ -z "${OPS}" || ! "${OPS}" == *@* ]]; then
  echo "UYARI: EKOLOJIK_OPS_EMAIL tanımlı değil — outbox_failed ops e-posta atlanır"
  exit 0
fi

if [[ "${HOST}" != "127.0.0.1" && "${HOST}" != "localhost" && "${HOST}" != "::1" ]]; then
  echo "OK   uzak SMTP — yerel Postfix alias kontrolü atlandı"
  exit 0
fi

FAIL=0
if [[ "$(id -u)" != "0" ]]; then
  echo "UYARI: root değil — Postfix düzeltmesi için: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-imap-vps-alias-fix.sh"
else
  VA="$(postconf -h virtual_alias_maps 2>/dev/null || true)"
  if [[ "${VA}" != *ekolojik-inbound-virtual* ]]; then
    echo "HATA: virtual_alias_maps içinde ekolojik-inbound-virtual yok"
    echo "      Mevcut: ${VA:-boş}"
    echo "      Düzelt: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-imap-vps-alias-fix.sh"
    FAIL=1
  else
    echo "OK   virtual_alias_maps → ekolojik-inbound-virtual"
  fi

  if [[ -f "${VIRTUAL_FILE}" ]]; then
    RES="$(postmap -q "${OPS}" "hash:${VIRTUAL_FILE}" 2>/dev/null || true)"
    if [[ -n "${RES}" ]]; then
      echo "OK   postmap ${OPS} → ${RES}"
    else
      echo "HATA: ${VIRTUAL_FILE} içinde ${OPS} yok"
      FAIL=1
    fi
  else
    echo "HATA: ${VIRTUAL_FILE} bulunamadı — imap-vps-alias-fix çalıştırın"
    FAIL=1
  fi

  if command -v sendmail >/dev/null 2>&1; then
    if sendmail -bv "${OPS}" 2>&1 | grep -qiE 'deliverable|mailer|virtual'; then
      echo "OK   sendmail -bv ${OPS}"
    else
      OUT="$(sendmail -bv "${OPS}" 2>&1 || true)"
      if grep -qiE 'unknown|reject|unavailable|error' <<<"${OUT}"; then
        echo "HATA: sendmail -bv başarısız"
        echo "      ${OUT}" | head -3
        FAIL=1
      else
        echo "OK   sendmail -bv (muhtemel teslim)"
      fi
    fi
  fi
fi

if [[ "${FAIL}" -ne 0 ]]; then
  echo ""
  echo "Kök neden örneği: ops outbox bildirimi ${OPS} adresine gider; Postfix virtual alias yoksa"
  echo "550 Recipient address rejected → binlerce failed JSON (outbox-failed-ops döngüsü)."
  exit 1
fi

echo ""
echo "✓ Ops alıcı yerel relay ile uyumlu"
exit 0
