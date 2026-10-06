#!/usr/bin/env bash
# Faz 5 hijyen — failed outbox JSON → archive/ (smoke / bilinmeyen alıcı artığı)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
FAILED_DIR="${INSTALL_DIR}/data/email-outbox/failed"
ARCHIVE_DIR="${FAILED_DIR}/archive"
DRY="${EKOLOJIK_DRY_RUN:-0}"

if [[ ! -d "${FAILED_DIR}" ]]; then
  echo "OK   failed klasörü yok — temiz"
  exit 0
fi

shopt -s nullglob
FILES=("${FAILED_DIR}"/*.json)
shopt -u nullglob

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "OK   failed=0 (dosya yok)"
  exit 0
fi

echo "=== Outbox failed arşiv ==="
echo "Kaynak: ${FAILED_DIR}"
echo "Adet:   ${#FILES[@]}"
if [[ "${DRY}" == "1" ]]; then
  for f in "${FILES[@]}"; do
    echo "DRY  $(basename "$f")"
  done
  echo "Uygulamak için: EKOLOJIK_DRY_RUN=0 bash $0 ${INSTALL_DIR}"
  exit 0
fi

mkdir -p "${ARCHIVE_DIR}"
STAMP="$(date +%Y%m%d-%H%M%S)"
for f in "${FILES[@]}"; do
  base="$(basename "$f")"
  mv "$f" "${ARCHIVE_DIR}/${STAMP}-${base}"
done

echo "OK   ${#FILES[@]} dosya → ${ARCHIVE_DIR}/"
HEALTH_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}/api/email/health"
if command -v curl >/dev/null 2>&1; then
  curl -fsS "${HEALTH_URL}" 2>/dev/null | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
console.log('outbox failed', j.counts?.failed ?? '?');
" || true
fi
echo "✓ failed arşivlendi — Ayarlar panelinde failed=0 olmalı"
