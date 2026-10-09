#!/usr/bin/env bash
# Repo kökünde Playwright (dev) + Chromium — NB görsel smoke için.
# Kullanım: ensure_playwright [REPO_ROOT]
set -euo pipefail

ensure_playwright() {
  local root="${1:-${EKOLOJIK_REPO_ROOT:-}}"
  if [[ -z "${root}" || ! -f "${root}/package.json" ]]; then
    return 1
  fi
  if node -e "import('playwright').then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
    return 0
  fi
  echo "==> Playwright (dev) kuruluyor: ${root}"
  (
    cd "${root}"
    # VPS deploy NODE_ENV=production olabilir; devDependencies için development zorunlu
    NODE_ENV=development npm install --include=dev --no-audit --no-fund
    npx playwright install chromium
  )
  node -e "import('playwright').then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  ensure_playwright "${1:-${EKOLOJIK_REPO_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}}"
fi
