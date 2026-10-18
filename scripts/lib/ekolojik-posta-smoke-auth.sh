#!/usr/bin/env bash
# Faz doğrulama scriptleri — Faz 38 Bearer (mint / QA token)
# Kullanım:
#   source .../ekolojik-posta-smoke-auth.sh
#   ekolojik_posta_smoke_auth_init "/var/www/market-pos"
#   posta_curl "${BASE}/api/posta/inbox?..."
set -euo pipefail

EKOLOJIK_POSTA_SMOKE_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POSTA_SMOKE_TOKEN=""
POSTA_SMOKE_AUTH_H=""

ekolojik_posta_smoke_auth_init() {
  local runtime_root="${1:-${EKOLOJIK_VERIFY_ROOT:-/var/www/market-pos}}"
  local base_url="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
  export EKOLOJIK_REPO_ROOT="${EKOLOJIK_REPO_ROOT:-$(cd "${EKOLOJIK_POSTA_SMOKE_LIB_DIR}/../.." && pwd)}"
  export EKOLOJIK_QA_DATA_DIR="${EKOLOJIK_QA_DATA_DIR:-${runtime_root}/data}"
  export EKOLOJIK_VERIFY_BASE_URL="${base_url}"

  # shellcheck source=scripts/lib/ekolojik-posta-qa-token.sh
  source "${EKOLOJIK_POSTA_SMOKE_LIB_DIR}/ekolojik-posta-qa-token.sh"
  POSTA_SMOKE_TOKEN=""
  if POSTA_SMOKE_TOKEN="$(ekolojik_resolve_posta_qa_token "${base_url}")"; then
    POSTA_SMOKE_AUTH_H="Authorization: Bearer ${POSTA_SMOKE_TOKEN}"
    return 0
  fi
  echo "HATA: Posta Bearer alınamadı (Faz 38) — ${runtime_root}/data mint veya EKOLOJIK_POS_QA_TOKEN"
  return 1
}

posta_curl() {
  if [[ -z "${POSTA_SMOKE_AUTH_H}" ]]; then
    echo "HATA: posta_curl — önce ekolojik_posta_smoke_auth_init"
    return 1
  fi
  curl -fsS -H "${POSTA_SMOKE_AUTH_H}" "$@"
}

posta_sse_url() {
  local base="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"
  local enc
  enc="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "${POSTA_SMOKE_TOKEN}")"
  printf '%s/api/posta/events?access_token=%s' "${base%/}" "${enc}"
}
