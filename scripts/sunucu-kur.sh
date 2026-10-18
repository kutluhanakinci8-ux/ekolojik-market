#!/usr/bin/env bash
# Market POS — doğrudan sunucu kurulumu (GitHub / git gerekmez)
#
# Kullanım A — paket dosyasıyla:
#   tar xzf market-pos-kurulum.tar.gz -C /var/www/market-pos
#   bash /var/www/market-pos/kur.sh
#
# Kullanım B — klasör kopyalandıysa (SFTP/rsync):
#   bash /path/to/market-pos/scripts/sunucu-kur.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/dist/index.html" ]]; then
  APP_DIR="$SCRIPT_DIR"
else
  APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi
INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
PORT="${PORT:-5180}"

echo "==> Market POS doğrudan kurulum"
echo "    Kaynak : $APP_DIR"
echo "    Hedef  : $INSTALL_DIR"
echo "    Port   : $PORT"

if ! command -v node >/dev/null 2>&1; then
  echo "HATA: Node.js gerekli (node -v ile kontrol edin)"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  echo "HATA: Node 18+ gerekli (mevcut: $(node -v))"
  exit 1
fi

if [[ ! -d "$APP_DIR/dist" ]]; then
  echo "HATA: dist/ klasörü yok — önce build alın veya kurulum paketini kullanın"
  exit 1
fi

if [[ "$APP_DIR" != "$INSTALL_DIR" ]]; then
  echo "==> Dosyalar kopyalanıyor..."
  mkdir -p "$INSTALL_DIR"
  rsync -a --delete \
    --exclude node_modules \
    --exclude src \
    --exclude '*.ts' \
    --exclude tsconfig.json \
    --exclude vite.config.ts \
    "$APP_DIR/" "$INSTALL_DIR/"
fi

cd "$INSTALL_DIR"

if [[ ! -f server.mjs ]]; then
  echo "HATA: server.mjs bulunamadı"
  exit 1
fi

echo "==> PM2 başlatılıyor..."
if command -v pm2 >/dev/null 2>&1; then
  PORT="$PORT" pm2 delete market-pos 2>/dev/null || true
  PORT="$PORT" pm2 start ecosystem.config.cjs
  pm2 save
else
  echo "UYARI: PM2 yok. Elle başlatmak için:"
  echo "  cd $INSTALL_DIR && PORT=$PORT node server.mjs"
  nohup env PORT="$PORT" node server.mjs > /var/log/market-pos.log 2>&1 &
  echo "  PID: $!"
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SUNUCU_IP')"
echo ""
echo "✓ Kurulum tamam!"
echo "  Sunucu içi : http://127.0.0.1:$PORT"
echo "  Dış erişim : http://${IP}:$PORT"
echo ""
echo "  Durum : pm2 status market-pos"
echo "  Log   : pm2 logs market-pos"
echo ""
echo "  Mali yazıcı (InPOS): Kasa Windows PC'de inpos-bridge çalıştırın."
echo "  VPS'te sadece web uygulaması çalışır — fiş köprüsü kasa bilgisayarında."
