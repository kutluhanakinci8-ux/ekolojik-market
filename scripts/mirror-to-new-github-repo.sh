#!/usr/bin/env bash
# Yeni GitHub reposuna taşıma (org'da boş repo oluşturduktan sonra)
# Örnek: ./scripts/mirror-to-new-github-repo.sh harikaotoservisinfo-spec/ekolojik-market-pos
set -euo pipefail
TARGET="${1:?Kullanım: $0 org/repo-adi}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "Bu klasör git repo değil."
  exit 1
fi
git remote remove publish 2>/dev/null || true
git remote add publish "https://github.com/${TARGET}.git"
git push -u publish main
echo "Tamam: https://github.com/${TARGET}"
