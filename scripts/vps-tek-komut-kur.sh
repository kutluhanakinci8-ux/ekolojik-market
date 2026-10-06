#!/usr/bin/env bash
# Ekolojik Market POS — VPS'te tek komut kurulum/güncelleme
#
# Sunucuda root olarak (public repo veya release paketi):
#   curl -fsSL "https://raw.githubusercontent.com/harikaotoservisinfo-spec/ekolojik-market-pos/main/scripts/vps-tek-komut-kur.sh" | bash
#
set -euo pipefail

BRANCH="${BRANCH:-main}"
REPO_RAW="https://raw.githubusercontent.com/harikaotoservisinfo-spec/ekolojik-market-pos/${BRANCH}"
INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
PORT="${PORT:-5180}"
TMP="/tmp/market-pos-kurulum.tar.gz"

echo "==> Ekolojik Market POS kurulum paketi indiriliyor..."
if ! curl -fsSL -o "$TMP" "${REPO_RAW}/release/market-pos-kurulum.tar.gz"; then
  echo "Paket yoksa git ile kurun:"
  echo "  curl -fsSL ${REPO_RAW}/scripts/deploy-vps.sh | bash"
  exit 1
fi

echo "==> ${INSTALL_DIR} hazırlanıyor..."
mkdir -p "$INSTALL_DIR"
tar xzf "$TMP" -C "$INSTALL_DIR"
rm -f "$TMP"

echo "==> PM2 ile başlatılıyor..."
export PORT
bash "$INSTALL_DIR/kur.sh"

echo ""
echo "Tamam. Tarayıcı: http://$(hostname -I 2>/dev/null | awk '{print $1}'):${PORT}"
