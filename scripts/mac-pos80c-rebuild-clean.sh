#!/usr/bin/env bash
# POS-80C — temiz sürücü (koyuluk yok). Mac'te c0/Ç0 ve LIMA üst üste binmesi için.
# Kullanım: bash scripts/mac-pos80c-rebuild-clean.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
export APPLY_POS80_DARKNESS=0
bash "$DIR/mac-pos80c-cups-install.sh"
echo ""
echo "=== Dogrulama (Mac) ==="
echo "  printf 'LIMA TEST\\n' | lp -d Printer_POS_80C"
echo "  Beklenen: LIMA TEST (basinda Ç0/c0 OLMAMALI)"
echo ""
echo "pm2 sadece VPS sunucusunda; Mac'te gerekmez."
