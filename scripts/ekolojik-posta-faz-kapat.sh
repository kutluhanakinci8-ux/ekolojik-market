#!/usr/bin/env bash
# Posta parite — faz bitince: main'e merge + push + VPS deploy
# Kullanım:
#   bash scripts/ekolojik-posta-faz-kapat.sh "Faz 7" cursor/posta-faz6-7-94bd
# Cloud Agent: VPS_SSH_KEY veya VPS_SSH_KEY_B64 tanımlıysa scripts/agent-deploy.sh çalışır.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAZ_LABEL="${1:?Faz adı gerekli (ör. Faz 7)}"
FEATURE_BRANCH="${2:?Branch gerekli (ör. cursor/posta-faz6-7-94bd)}"
REMOTE="${GIT_REMOTE:-publish}"
MAIN_BRANCH="${MAIN_BRANCH:-main}"

cd "${REPO_ROOT}"
echo "==> Posta ${FAZ_LABEL} — merge & deploy"
echo "    Branch: ${FEATURE_BRANCH} → ${MAIN_BRANCH}"

git fetch "${REMOTE}" "${MAIN_BRANCH}"
git checkout "${MAIN_BRANCH}"
git pull --ff-only "${REMOTE}" "${MAIN_BRANCH}" || git reset --hard "${REMOTE}/${MAIN_BRANCH}"

if git merge-base --is-ancestor "${FEATURE_BRANCH}" HEAD 2>/dev/null; then
  echo "    Zaten main'de: ${FEATURE_BRANCH}"
else
  git merge --no-ff "${FEATURE_BRANCH}" -m "Merge branch '${FEATURE_BRANCH}' — Posta ${FAZ_LABEL}"
fi

git push "${REMOTE}" "${MAIN_BRANCH}"
echo "    Git: $(git rev-parse --short HEAD) pushed"

if bash "${REPO_ROOT}/scripts/agent-deploy.sh"; then
  echo "✓ VPS deploy tamam (Posta ${FAZ_LABEL})"
else
  echo ""
  echo "SSH deploy atlandı (VPS_SSH_KEY / VPS_SSH_KEY_B64 yok)."
  echo "VPS'te manuel:"
  echo "  cd /var/www/ekolojik-market-pos && git pull origin main && bash scripts/sunucu-market-pos-otomatik-deploy.sh"
  echo ""
  exit 2
fi
