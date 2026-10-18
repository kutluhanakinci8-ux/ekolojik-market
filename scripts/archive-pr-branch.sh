#!/usr/bin/env bash
# Açık PR dalını yedekle: meta + diff (repo içi arşiv)
set -euo pipefail
PR="${1:?PR numarası gerekli}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="${2:-$(date -u +%Y-%m-%d)}"
head="$(gh pr view "$PR" --json headRefName -q .headRefName)"
dir="${REPO_ROOT}/backups/archived-pr-branches-${STAMP}/pr-${PR}"
mkdir -p "$dir"
cd "$REPO_ROOT"
git fetch origin "$head" main
gh pr view "$PR" --json number,title,body,headRefName,baseRefName,url,createdAt,state > "$dir/pr-meta.json"
git rev-parse "origin/$head" > "$dir/head-sha.txt"
git log "origin/main..origin/$head" --oneline > "$dir/commits.txt" || true
git diff "origin/main...origin/$head" > "$dir/full.diff" || true
echo "✓ Arşiv: $dir"
