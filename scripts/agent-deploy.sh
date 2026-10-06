#!/usr/bin/env bash
# Cloud Agent / CI — Ekolojik Market POS VPS deploy (SSH)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${BRANCH:-$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null || echo main)}"
HOST="${VPS_SSH_HOST:-168.231.109.27}"
USER="${VPS_SSH_USER:-root}"
PORT="${VPS_SSH_PORT:-22}"
VPS_REPO="${VPS_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "==> Ekolojik Market POS deploy (branch: ${BRANCH})"

deploy_via_ssh() {
  local key_file
  key_file="$(mktemp)"
  trap 'rm -f "$key_file"' RETURN

  if [[ -n "${VPS_SSH_KEY_B64:-}" ]]; then
    printf '%s' "$VPS_SSH_KEY_B64" | tr -d '[:space:]' | base64 -d > "$key_file"
  elif [[ -n "${VPS_SSH_KEY:-}" ]]; then
    printf '%b\n' "$VPS_SSH_KEY" | sed 's/\r$//' > "$key_file"
  elif [[ -n "${VPS_SSH_KEY_FILE:-}" && -f "$VPS_SSH_KEY_FILE" ]]; then
    key_file="$VPS_SSH_KEY_FILE"
    trap - RETURN
  else
    return 1
  fi

  chmod 600 "$key_file"
  ssh-keygen -y -f "$key_file" >/dev/null 2>&1 || return 1

  ssh -i "$key_file" -p "$PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new \
    "${USER}@${HOST}" \
    "export REPO_ROOT=${VPS_REPO} BRANCH=${BRANCH} && bash ${VPS_REPO}/scripts/sunucu-market-pos-deploy.sh"
}

deploy_via_password() {
  if [[ -z "${VPS_SSH_PASS:-}" ]]; then
    return 1
  fi
  if ! command -v sshpass >/dev/null 2>&1; then
    echo "sshpass yüklü değil — VPS_SSH_PASS kullanılamıyor"
    return 1
  fi
  SSHPASS="${VPS_SSH_PASS}" sshpass -e ssh -p "$PORT" -o StrictHostKeyChecking=accept-new \
    -o PreferredAuthentications=password -o PubkeyAuthentication=no \
    "${USER}@${HOST}" \
    "export REPO_ROOT=${VPS_REPO} BRANCH=${BRANCH} GIT_REMOTE=origin && bash ${VPS_REPO}/scripts/sunucu-market-pos-deploy.sh"
}

if deploy_via_ssh; then
  echo "✓ SSH deploy tamam (key)"
  exit 0
fi

if deploy_via_password; then
  echo "✓ SSH deploy tamam (password env)"
  exit 0
fi

echo "SSH deploy yapılandırılmadı (VPS_SSH_KEY / VPS_SSH_KEY_B64 / VPS_SSH_PASS)."
exit 1
