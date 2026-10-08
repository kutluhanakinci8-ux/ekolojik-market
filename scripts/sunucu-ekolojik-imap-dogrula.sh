#!/usr/bin/env bash
# Faz 7 — Ekolojik IMAP doğrulama (Posta hub Gelen; Faz 38 Bearer)
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
export EKOLOJIK_REPO_ROOT="${REPO_ROOT}"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"

echo "=== Ekolojik IMAP doğrulama (Faz 7) ==="
echo "Kök: ${ROOT}"
echo "API:  ${BASE_URL}"

# shellcheck source=scripts/lib/ekolojik-posta-qa-token.sh
source "${SCRIPT_DIR}/lib/ekolojik-posta-qa-token.sh"
EKOLOJIK_QA_DATA_DIR="${ROOT}/data"
export EKOLOJIK_QA_DATA_DIR
TOKEN=""
if TOKEN="$(ekolojik_resolve_posta_qa_token "${BASE_URL}")"; then
  echo "OK   Posta Bearer (${EKOLOJIK_POS_QA_TOKEN_USER:-qa})"
else
  echo "HATA: Posta token alınamadı — IMAP health Faz 38 auth gerekir"
  exit 1
fi

HEALTH="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/posta/imap/health" 2>/dev/null || true)"
if [[ -z "${HEALTH}" ]]; then
  echo "HATA: /api/posta/imap/health yanıt vermedi"
  exit 1
fi

echo "${HEALTH}" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('imapConfigured', j.imapConfigured, 'verified', j.imapVerified);
if (j.imapHost) console.log('host', j.imapHost, 'user', j.imapUser);
if (j.message) console.log('message', j.message);
if (j.error) console.log('error', j.error);
if (!j.imapConfigured) process.exit(2);
if (!j.imapVerified) process.exit(3);
"

code=$?
if [[ $code -eq 0 ]]; then
  echo "✓ IMAP hazır"
  exit 0
fi
if [[ $code -eq 2 ]]; then
  echo "UYARI: EKOLOJIK_IMAP_* tanımlı değil — docs/EKOLOJIK-FAZ7-IMAP-RUNBOOK.md"
  exit 2
fi
echo "HATA: IMAP bağlantısı başarısız"
exit 3
