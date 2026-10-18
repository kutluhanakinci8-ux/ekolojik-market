#!/usr/bin/env bash
# Tek komut: main çek + build + /var/www/market-pos kur (VPS root)
#   bash /var/www/ekolojik-market-pos/scripts/sunucu-market-pos-otomatik-deploy.sh
set -euo pipefail
export REPO_ROOT="${REPO_ROOT:-/var/www/ekolojik-market-pos}"
export BRANCH="${BRANCH:-main}"
export GIT_REMOTE="${GIT_REMOTE:-origin}"
exec bash "${REPO_ROOT}/scripts/sunucu-market-pos-deploy.sh"
