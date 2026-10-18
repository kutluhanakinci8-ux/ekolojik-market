#!/usr/bin/env bash
# Faz 39 — failed outbox JSON → failed/archive/{tenantId}/ (tenant partition uyumlu)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
FAILED_ROOT="${INSTALL_DIR}/data/email-outbox/failed"
DRY="${EKOLOJIK_DRY_RUN:-0}"
TENANT_FILTER="${EKOLOJIK_OUTBOX_ARCHIVE_TENANT:-}"

if [[ ! -d "${FAILED_ROOT}" ]]; then
  echo "OK   failed klasörü yok — temiz"
  exit 0
fi

TOTAL=0
STAMP="$(date +%Y%m%d-%H%M%S)"

# Eski düzen: failed/archive/*.json (tenant alt klasörü olmadan) → archive/main
ARCHIVE_ROOT="${FAILED_ROOT}/archive"
if [[ -d "${ARCHIVE_ROOT}" ]]; then
  shopt -s nullglob
  stray=( "${ARCHIVE_ROOT}"/*.json )
  shopt -u nullglob
  if [[ ${#stray[@]} -gt 0 ]]; then
    mkdir -p "${ARCHIVE_ROOT}/main"
    for f in "${stray[@]}"; do
      if [[ "${DRY}" == "1" ]]; then
        echo "DRY  taşı ${f} → ${ARCHIVE_ROOT}/main/"
      else
        mv "$f" "${ARCHIVE_ROOT}/main/"
      fi
      TOTAL=$((TOTAL + 1))
    done
  fi
fi

shopt -s nullglob
LEGACY=("${FAILED_ROOT}"/*.json)
shopt -u nullglob

archive_file() {
  local src="$1"
  local tenant_dir="$2"
  local base
  base="$(basename "$src")"
  mkdir -p "${tenant_dir}"
  if [[ "${DRY}" == "1" ]]; then
    echo "DRY  ${src} → ${tenant_dir}/${STAMP}-${base}"
  else
    mv "$src" "${tenant_dir}/${STAMP}-${base}"
  fi
  TOTAL=$((TOTAL + 1))
}

for f in "${LEGACY[@]}"; do
  archive_file "$f" "${FAILED_ROOT}/archive/main"
done

while IFS= read -r -d '' tenant_path; do
  tenant="$(basename "$tenant_path")"
  if [[ "${tenant}" == "archive" ]]; then
    continue
  fi
  if [[ -n "${TENANT_FILTER}" && "${tenant}" != "${TENANT_FILTER}" ]]; then
    continue
  fi
  shopt -s nullglob
  files=("${tenant_path}"/*.json)
  shopt -u nullglob
  for f in "${files[@]}"; do
    archive_file "$f" "${FAILED_ROOT}/archive/${tenant}"
  done
done < <(find "${FAILED_ROOT}" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null || true)

if [[ "${TOTAL}" -eq 0 ]]; then
  echo "OK   failed=0 (arşivlenecek dosya yok)"
  exit 0
fi

echo "=== Outbox failed arşiv (Faz 39) ==="
echo "Kök:   ${FAILED_ROOT}"
echo "Adet:  ${TOTAL}"
if [[ "${DRY}" == "1" ]]; then
  echo "Uygulamak için: EKOLOJIK_DRY_RUN=0 bash $0 ${INSTALL_DIR}"
  exit 0
fi

HEALTH_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}/api/email/health"
if command -v curl >/dev/null 2>&1; then
  curl -fsS "${HEALTH_URL}" 2>/dev/null | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('outbox failed', j.counts?.failed ?? '?');
" || true
fi
echo "✓ ${TOTAL} dosya arşivlendi — Hub’da failed sayısı düşmeli"
echo "Haftalık cron örneği: 0 4 * * 0 EKOLOJIK_DRY_RUN=0 ${INSTALL_DIR%/market-pos}/ekolojik-market-pos/scripts/sunucu-ekolojik-outbox-failed-arsivle.sh ${INSTALL_DIR}"
