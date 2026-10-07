#!/usr/bin/env bash
# Faz 27 — NB PM-2 compose RTE
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 27 doğrulama ==="
test -f "${ROOT}/server/postaComposeRte.mjs" || exit 1
test -f "${ROOT}/src/components/posta/PostaComposeRichEditor.tsx" || exit 1

curl -fsS "${BASE}/api/posta/compose/rte-capabilities" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.formats?.includes('html') || !d.toolbar?.length) process.exit(1);
console.log('OK   rte-capabilities', d.toolbar.length, 'tools');
"

echo "✓ Faz 27 doğrulama geçti"
