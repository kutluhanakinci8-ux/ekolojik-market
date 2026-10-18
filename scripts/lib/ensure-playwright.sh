#!/usr/bin/env bash
# Repo kökünde Playwright (dev) + Chromium — NB görsel smoke için.
# Kullanım: ensure_playwright [REPO_ROOT]
set -euo pipefail

ensure_playwright() {
  local root="${1:-${EKOLOJIK_REPO_ROOT:-}}"
  if [[ -z "${root}" || ! -f "${root}/package.json" ]]; then
    return 1
  fi
  export PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-${root}/.playwright-browsers}"
  mkdir -p "${PLAYWRIGHT_BROWSERS_PATH}"

  _pw_import_ok() {
    (cd "${root}" && node -e "import('playwright').then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null)
  }

  if _pw_import_ok; then
    (cd "${root}" && export PLAYWRIGHT_BROWSERS_PATH && npx playwright install chromium 2>/dev/null) || true
    return 0
  fi

  echo "==> Playwright (dev) kuruluyor: ${root}"
  (
    cd "${root}"
    export PLAYWRIGHT_BROWSERS_PATH
    NODE_ENV=development npm install --include=dev --no-audit --no-fund
    if ! npm ls playwright --depth=0 >/dev/null 2>&1; then
      NODE_ENV=development npm install -D playwright --no-audit --no-fund
    fi
    npx playwright install chromium
    if [[ "$(id -u 2>/dev/null || echo 1)" == "0" ]] && command -v apt-get >/dev/null 2>&1; then
      npx playwright install-deps chromium 2>/dev/null || true
    fi
  )

  if _pw_import_ok; then
    return 0
  fi
  echo "HATA: Playwright import başarısız — NODE_ENV=development npm install && npx playwright install chromium"
  return 1
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  ensure_playwright "${1:-${EKOLOJIK_REPO_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}}"
fi
