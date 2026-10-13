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

postmap -q "destek@ekolojikmarket.com.tr" "hash:/etc/postfix/ekolojik-inbound-virtual-destek" >/dev/null \
  && echo "OK   Postfix virtual destek@" \
  || echo "UYARI: Postfix virtual destek@ yok — sunucu-ekolojik-destek-mailbox.sh --apply"

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
