#!/usr/bin/env bash
# Platform destek@ IMAP doğrulama (EKOLOJIK_SUPPORT_IMAP_*)
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
ENV_FILE="${ROOT}/.env"

echo "=== Ekolojik destek@ IMAP doğrulama ==="
echo "Kök: ${ROOT}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "HATA: ${ENV_FILE} yok"
  exit 1
fi

# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${SCRIPT_DIR}/lib/ekolojik-env-load.sh"
ekolojik_load_env "${ENV_FILE}"

if [[ -z "${EKOLOJIK_SUPPORT_IMAP_PASS:-}" ]]; then
  echo "HATA: EKOLOJIK_SUPPORT_IMAP_PASS tanımlı değil"
  exit 2
fi

DESTEK_ADDR="${EKOLOJIK_SUPPORT_INBOX:-destek@ekolojikmarket.com.tr}"
postmap -q "${DESTEK_ADDR}" "hash:/etc/postfix/ekolojik-inbound-virtual-destek" >/dev/null \
  && echo "OK   Postfix virtual ${DESTEK_ADDR}" \
  || echo "UYARI: Postfix virtual ${DESTEK_ADDR} yok — sunucu-ekolojik-destek-mailbox.sh --apply"

if [[ "$(id -u)" == "0" ]] && command -v sendmail >/dev/null 2>&1; then
  OUT="$(sendmail -bv "${DESTEK_ADDR}" 2>&1 || true)"
  if grep -qiE 'unknown|reject|unavailable|undeliverable|550' <<<"${OUT}"; then
    echo "UYARI: sendmail -bv ${DESTEK_ADDR} — Postfix teslim etmiyor (outbox 550)"
    echo "       bash ${REPO_ROOT}/scripts/sunucu-ekolojik-destek-mailbox.sh --apply"
  else
    echo "OK   sendmail -bv ${DESTEK_ADDR}"
  fi
fi

cd "${ROOT}"
node --input-type=module -e "
import { verifyImapMailbox } from './server/billEmailImap.mjs';
import { getPlatformSupportImapConfig, isPlatformSupportImapConfigured } from './server/platformSupportMailConfig.mjs';

if (!isPlatformSupportImapConfigured()) {
  console.error('HATA: isPlatformSupportImapConfigured false');
  process.exit(2);
}
const cfg = getPlatformSupportImapConfig();
const r = await verifyImapMailbox(cfg);
console.log(r.message);
if (!r.ok) process.exit(3);
"

echo "✓ destek@ IMAP hazır"
exit 0
