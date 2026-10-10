#!/usr/bin/env bash
# Canlı market-pos data yedeği — deploy öncesi zorunlu (veri dokunulmaz politikası)
set -euo pipefail

DATA_DIR="${1:-/var/www/market-pos/data}"
BACKUP_ROOT="${MARKET_POS_DATA_BACKUP_DIR:-$(dirname "$DATA_DIR")/data-backups}"
KEEP="${MARKET_POS_DATA_BACKUP_KEEP:-14}"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "UYARI: data dizini yok: $DATA_DIR"
  exit 0
fi

mkdir -p "$BACKUP_ROOT"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
ARCHIVE="${BACKUP_ROOT}/market-pos-data-${STAMP}.tar.gz"

tar -czf "$ARCHIVE" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
echo "✓ Data yedeği: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Eski yedekleri temizle (KEEP adet kalsın)
if [[ "$KEEP" =~ ^[0-9]+$ ]] && [[ "$KEEP" -gt 0 ]]; then
  mapfile -t OLD < <(ls -1t "${BACKUP_ROOT}"/market-pos-data-*.tar.gz 2>/dev/null || true)
  if ((${#OLD[@]} > KEEP)); then
    for f in "${OLD[@]:KEEP}"; do
      rm -f "$f"
    done
  fi
fi
