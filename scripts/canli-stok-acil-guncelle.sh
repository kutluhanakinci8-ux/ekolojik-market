#!/usr/bin/env bash
# VPS’te bir kez çalıştırın (eski açık sekmeler 13.437 yazmasın diye sunucu PUT/GET düzeltmesi + build):
#   cd /var/www/ekolojik-market-pos && git pull --ff-only origin main && bash scripts/sunucu-market-pos-deploy.sh
#
# Deploy sonrası stok özeti: Toplam stok ≈ 1326 (irsaliye LUY2026000000002)
set -euo pipefail
REPO_ROOT="${REPO_ROOT:-/var/www/ekolojik-market-pos}"
cd "$REPO_ROOT"
git fetch origin main
git checkout main 2>/dev/null || git checkout -B main origin/main
git checkout -- tsconfig.tsbuildinfo 2>/dev/null || true
git pull --ff-only origin main || git reset --hard origin/main
bash scripts/sunucu-market-pos-deploy.sh
node scripts/apply-irsaliye-stock.mjs /var/www/market-pos/data
echo "Bitti. Tüm cihazlarda POS sekmelerini kapatıp tek sekmede Ctrl+F5 yapın."
