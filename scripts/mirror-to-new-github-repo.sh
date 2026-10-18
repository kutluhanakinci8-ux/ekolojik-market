#!/usr/bin/env bash
# Yeni GitHub reposuna taşıma (GitHub'da boş repo oluşturduktan sonra)
# Örnek: ./scripts/mirror-to-new-github-repo.sh harikaotoservisinfo-spec/ekolojik-market-pos
#
# Kimlik (private org repo):
#   export GITHUB_TOKEN=ghp_...
# veya SSH: export GIT_SSH_COMMAND=... / remote URL git@github.com:...
set -euo pipefail
TARGET="${1:?Kullanım: $0 org/repo-adi}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PUBLISH_URL="https://github.com/${TARGET}.git"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  PUBLISH_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${TARGET}.git"
fi

git remote remove publish 2>/dev/null || true
git remote add publish "$PUBLISH_URL"

echo "==> ${TARGET} reposuna main olarak push (mevcut branch: $(git branch --show-current))"
git push -u publish HEAD:main

echo "Tamam: https://github.com/${TARGET}"
