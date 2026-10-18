#!/usr/bin/env bash
# Mac kasa — fiş köprüsü teşhis (USB POS-80C)
#   cd ekolojik-market && bash scripts/diag-mac-receipt-bridge.sh
set -euo pipefail

LABEL="com.greenleaf.market.receipt-bridge"
PORT="${LIMA_RAW_PRINT_PORT:-18765}"
QUEUE="${POS80_QUEUE_NAME:-Printer_POS_80C}"
HOME_BRIDGE="${HOME}/.greenleaf-market-pos"

section() { echo ""; echo "══ $1 ══"; }

section "1) Bu Mac mi? (ssh DEĞİL)"
echo "Host: $(hostname)  User: $(whoami)"
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "UYARI: Bu script macOS için — $(uname -s)"
fi

section "2) CUPS yazıcı kuyrukları"
if command -v lpstat >/dev/null 2>&1; then
  lpstat -p 2>&1 || true
  echo "Varsayılan: $(lpstat -d 2>/dev/null || echo '?')"
else
  echo "lpstat yok"
fi

section "3) Fiş servisi (127.0.0.1:${PORT})"
if curl -fsS --connect-timeout 2 "http://127.0.0.1:${PORT}/health" 2>/dev/null; then
  echo ""
  echo "✓ Health OK"
else
  echo "✗ Health yanıt vermiyor — LaunchAgent veya köprü kapalı"
fi

section "4) LaunchAgent (${LABEL})"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
if [[ -f "${PLIST}" ]]; then
  echo "Plist: ${PLIST}"
  launchctl print "gui/$(id -u)/${LABEL}" 2>&1 | head -n 20 || launchctl list | grep -i greenleaf || true
else
  echo "Kurulu değil → git pull && bash scripts/install-macos-receipt-bridge-launchd.sh"
fi

section "5) Köprü logları"
for f in "${HOME_BRIDGE}/bridge.log" "${HOME_BRIDGE}/bridge.err.log"; do
  if [[ -f "$f" ]]; then
    echo "--- tail $f ---"
    tail -n 15 "$f" || true
  fi
done

section "6) Test fiş (ham ESC/POS)"
TEST_JSON=$(printf '%s' '{"text":"GREENLEAF TEST FIS\nTarih: test\nTOPLAM 0,01 TL\n"}')
HTTP=$(curl -sS -o /tmp/fis-test-out.json -w "%{http_code}" \
  -X POST "http://127.0.0.1:${PORT}/print" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"GREENLEAF TEST\\nKuyruk test\\n\",\"printer\":\"Printer POS-80C\"}" \
  2>/dev/null || echo "000")
echo "HTTP ${HTTP}"
cat /tmp/fis-test-out.json 2>/dev/null || true
echo ""
if [[ "${HTTP}" == "200" ]]; then
  echo "✓ Köprü yazdırdı — yazıcıda TEST satırı çıkmalı"
else
  echo "✗ POST başarısız — yukarıdaki JSON error alanına bakın"
fi

section "7) Elle köprü (sadece test)"
echo "Health kapalıysa (repo içinde):"
echo "  export POS80_QUEUE_NAME=\"${QUEUE}\""
echo "  node scripts/lima-raw-print-bridge.mjs"
echo ""
echo "Bitti."
