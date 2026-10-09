#!/usr/bin/env bash
# POS-80C termal fiş — macOS CUPS (pos80.ppd + rastertopos derleme)
# Intel Mac: GitHub filter/64 LINUX ARM'dır — kullanmayın; bu script kaynaktan derler.
# Kullanım: bash mac-pos80c-cups-install.sh
set -euo pipefail

WORKDIR="${HOME}/Downloads/pos80-mac"
ZIP="${WORKDIR}/pos80-cups.zip"
URI="${POS80_USB_URI:-usb://Printer/POS-80C?serial=012345678AB}"
QUEUE="${POS80_QUEUE_NAME:-Printer_POS_80C}"

mkdir -p "$WORKDIR"
if [[ ! -f "$ZIP" ]]; then
  curl -fL -o "$ZIP" \
    'https://github.com/IntegersOfK/Hoin-POS-58-80/archive/refs/heads/master.zip'
fi

cd "$WORKDIR"
unzip -qo "$ZIP"
SRC="$WORKDIR/Hoin-POS-58-80-master"

# Varsayılan KAPALI: ESC 7 yamasi baslikta Ç0/c0 ve LIMA bozulmasi yapar (printf | lp testi).
APPLY_POS80_DARKNESS="${APPLY_POS80_DARKNESS:-0}"
if [[ "$APPLY_POS80_DARKNESS" == "1" ]]; then
  echo "→ Baski yogunlugu (ESC/POS) yamasi — APPLY_POS80_DARKNESS=1"
  DARK_PATCH="${DARK_PATCH:-$(dirname "$0")/mac-rastertopos-darkness.patch}"
  if [[ -f "$DARK_PATCH" ]]; then
    (cd "$SRC" && patch -p1 -N -r - < "$DARK_PATCH") || true
  fi
else
  echo "→ Koyuluk yamasi atlandi (temiz rastertopos). Koyu icin: APPLY_POS80_DARKNESS=1"
fi

cd "$SRC/rastertopos"

echo "→ rastertopos derleniyor (Mach-O olmalı)..."
make clean 2>/dev/null || true
make CC="${CC:-clang}" CFLAGS="-O2" LIBS="-lcups -lcupsimage -lm"

file ./rastertopos | grep -q 'Mach-O' || {
  echo "HATA: rastertopos macOS ikilisi değil. Xcode Command Line Tools: xcode-select --install"
  file ./rastertopos
  exit 1
}

FILTER=/usr/libexec/cups/filter/rastertopos
if [[ -f "$FILTER" ]]; then
  sudo cp "$FILTER" "${FILTER}.bak" 2>/dev/null || true
fi
sudo cp ./rastertopos "$FILTER"
sudo chmod 755 "$FILTER"

sudo mkdir -p /Library/Printers/PPDs/Contents/Resources
sudo cp "$SRC/ppd/pos80.ppd" /Library/Printers/PPDs/Contents/Resources/pos80.ppd

echo "→ Eski kuyruk siliniyor: $QUEUE"
sudo lpadmin -x "$QUEUE" 2>/dev/null || true

echo "→ POS-80 PPD ile kuyruk oluşturuluyor..."
sudo lpadmin -p "$QUEUE" -E \
  -v "$URI" \
  -P /Library/Printers/PPDs/Contents/Resources/pos80.ppd \
  -D 'Printer POS-80C' \
  -L "$(scutil --get ComputerName 2>/dev/null || echo Mac)"

sudo lpoptions -p "$QUEUE" -o PageSize=X80mmY3276mm
sudo lpadmin -d "$QUEUE"
sudo launchctl kickstart -k system/org.cups.cupsd 2>/dev/null || true

echo ""
lpoptions -p "$QUEUE" | grep -o "printer-make-and-model='[^']*'" || true
echo ""
echo "Test: printf 'LIMA TEST\\n' | lp -d $QUEUE"
echo "file /usr/libexec/cups/filter/rastertopos"
