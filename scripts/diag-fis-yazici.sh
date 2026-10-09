#!/usr/bin/env bash
# Fiş yazdırma teşhis — VPS (sunucu) + istemci notları
# Kullanım: bash scripts/diag-fis-yazici.sh
#           DATA_DIR=/var/www/market-pos/data bash scripts/diag-fis-yazici.sh
set -euo pipefail

DATA_DIR="${DATA_DIR:-/var/www/market-pos/data}"
REPO="${REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

echo "=============================================="
echo "  FIS YAZICI TESHIS — $(date -Iseconds)"
echo "  DATA_DIR=$DATA_DIR"
echo "=============================================="
echo ""
echo "NOT: Termal yazici (POS-80C) kasa Mac/PC USB baglidir."
echo "     Sunucu fisi BASMAZ; tarayici loglari ve store ayari burada."
echo ""
echo "!!! SUNUCUDA (root@srv...) lpstat / cups YOKTUR — 'command not found' NORMAL."
echo "    Yazici logu icin Mac'te YENI Terminal: prompt 'macbook@macbook-air ~' (ssh YOK)."
echo ""

section() { echo ""; echo "── $1 ──"; }

section "1) Sunucu fis olay logu (tarayicidan POST)"
for f in \
  "$DATA_DIR/receipt-print.log" \
  "$DATA_DIR/tenants/lima-market/receipt-print.log"; do
  if [[ -f "$f" ]]; then
    echo "# $f (son 25 satir)"
    tail -n 25 "$f" || true
  else
    echo "# (yok) $f"
  fi
done

section "2) store.json — receiptPrinter (main)"
if [[ -f "$DATA_DIR/store.json" ]]; then
  node -e "
    const s=JSON.parse(require('fs').readFileSync('$DATA_DIR/store.json','utf8'));
    console.log(JSON.stringify(s.settings?.receiptPrinter ?? '(kayit yok)', null, 2));
  "
else
  echo "store.json bulunamadi"
fi

section "3) lima-market — receiptPrinter"
L="$DATA_DIR/tenants/lima-market/store.json"
if [[ -f "$L" ]]; then
  node -e "
    const s=JSON.parse(require('fs').readFileSync('$L','utf8'));
    console.log('productProfile:', s.settings?.productProfile);
    console.log('receiptPrinter:', JSON.stringify(s.settings?.receiptPrinter ?? null, null, 2));
  "
else
  echo "lima store yok"
fi

section "4) PM2 market-pos (son 40 satir)"
if command -v pm2 >/dev/null 2>&1; then
  pm2 logs market-pos --nostream --lines 40 2>/dev/null || pm2 status
else
  echo "pm2 yok"
fi

section "5) API canli mi"
PORT="${PORT:-5180}"
curl -fsS -o /dev/null -w "HTTP %{http_code} http://127.0.0.1:${PORT}/\n" "http://127.0.0.1:${PORT}/" 2>/dev/null || echo "curl basarisiz"

section "6) Kasa Mac — yerelde calistirin"
cat <<'MAC'

  lpstat -p -d
  lpoptions -p Printer_POS_80C 2>/dev/null || lpoptions -p POS-80C 2>/dev/null || lpoptions -d
  # Erken kesim: Cutting=1 sayfa sonu (yanlis uzunlukta keser). Belge sonu icin:
  # sudo lpoptions -p Printer_POS_80C -o Cutting=2Cutattheendofdocument
  sudo tail -f /var/log/cups/error_log
  lpstat -o

MAC

echo ""
echo "Teshis bitti."
