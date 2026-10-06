#!/usr/bin/env bash
# Kurulum paketi oluştur (GitHub gerekmez — SFTP ile sunucuya atılır)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT/release"
PKG="$OUT_DIR/market-pos-kurulum.tar.gz"

echo "==> Build..."
cd "$ROOT"
npm run build

echo "==> Paket hazırlanıyor..."
rm -rf "$OUT_DIR/staging"
mkdir -p "$OUT_DIR/staging"

cp -r "$ROOT/dist" "$OUT_DIR/staging/"
cp "$ROOT/server.mjs" "$OUT_DIR/staging/"
mkdir -p "$OUT_DIR/staging/server"
cp "$ROOT/server/asatClient.mjs" "$OUT_DIR/staging/server/"
cp "$ROOT/server/asatProxy.mjs" "$OUT_DIR/staging/server/"
cp "$ROOT/server/faturaOdemelisinClient.mjs" "$OUT_DIR/staging/server/"
cp "$ROOT/server/odemeComTrClient.mjs" "$OUT_DIR/staging/server/"
cp -r "$ROOT/extension" "$OUT_DIR/staging/"
cp "$ROOT/ecosystem.config.cjs" "$OUT_DIR/staging/"
cp "$ROOT/scripts/sunucu-kur.sh" "$OUT_DIR/staging/kur.sh"
chmod +x "$OUT_DIR/staging/kur.sh"

mkdir -p "$OUT_DIR"
tar czf "$PKG" -C "$OUT_DIR/staging" .

SIZE="$(du -h "$PKG" | cut -f1)"
echo ""
echo "✓ Paket hazır: $PKG ($SIZE)"
echo ""
echo "Sunucuya yükleme (kendi PC'nizden):"
echo "  scp $PKG root@SUNUCU_IP:/root/"
echo ""
echo "Sunucuda kurulum:"
echo "  mkdir -p /var/www/market-pos"
echo "  tar xzf /root/market-pos-kurulum.tar.gz -C /var/www/market-pos"
echo "  bash /var/www/market-pos/kur.sh"
