#!/usr/bin/env bash
# Ekolojik Market POS — VPS kurulum / güncelleme betiği
# Kullanım: bash scripts/deploy-vps.sh
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/kutluhanakinci8-ux/ekolojik-market.git}"
BRANCH="${BRANCH:-main}"
REPO_ROOT="${REPO_ROOT:-/var/www/ekolojik-market-pos}"
PORT="${PORT:-5180}"

echo "==> Ekolojik Market POS VPS deploy"
echo "    Repo   : $REPO_URL"
echo "    Branch : $BRANCH"
echo "    Clone  : $REPO_ROOT"
echo "    Port   : $PORT"

if ! command -v node >/dev/null 2>&1; then
  echo "HATA: Node.js bulunamadı. Önce Node 18+ kurun."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "HATA: npm bulunamadı."
  exit 1
fi

mkdir -p "$(dirname "$REPO_ROOT")"

if [[ -d "$REPO_ROOT/.git" ]]; then
  echo "==> Mevcut repo güncelleniyor..."
  cd "$REPO_ROOT"
  git fetch origin "$BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH" || true
else
  echo "==> Repo klonlanıyor (shallow)..."
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$REPO_ROOT"
  cd "$REPO_ROOT"
fi

export REPO_ROOT
export BRANCH
bash "$REPO_ROOT/scripts/sunucu-market-pos-deploy.sh"
