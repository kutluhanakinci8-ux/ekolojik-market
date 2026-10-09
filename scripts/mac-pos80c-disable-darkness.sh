#!/usr/bin/env bash
# POS-80C — rastertopos koyuluk yamasını geri al (başta c0/çöp basıyorsa)
# Kullanım: bash scripts/mac-pos80c-disable-darkness.sh
set -euo pipefail

FILTER=/usr/libexec/cups/filter/rastertopos
BAK="${FILTER}.bak"

if [[ -f "$BAK" ]]; then
  echo "→ Yedek rastertopos geri yükleniyor..."
  sudo cp "$BAK" "$FILTER"
  sudo chmod 755 "$FILTER"
else
  echo "Yedek yok — temiz rastertopos yeniden derleniyor..."
  DIR="$(cd "$(dirname "$0")" && pwd)"
  exec bash "$DIR/mac-pos80c-rebuild-clean.sh"
fi

sudo launchctl kickstart -k system/org.cups.cupsd 2>/dev/null || true
echo "Test: printf 'LIMA TEST\\n' | lp -d Printer_POS_80C"
echo "Başta garip karakter yoksa fiş başlığı düzelmiş olmalı."
