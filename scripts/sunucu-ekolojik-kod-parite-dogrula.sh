#!/usr/bin/env bash
# Faz 7–12 kod paritesi — statik dosya + TypeScript derleme (VPS/DNS yok)
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "${REPO_ROOT}"

FAIL=0
ok() { echo "OK   $*"; }
bad() { echo "HATA: $*"; FAIL=1; }

echo "=== Ekolojik Posta kod paritesi (statik) ==="

REQUIRED=(
  server/postaInbox.mjs
  server/postaInboxFlags.mjs
  server/postaComposeDrafts.mjs
  server/postaImapMailboxes.mjs
  server/postaImapActions.mjs
  server/postaConversation.mjs
  server/postaComposeFormat.mjs
  server/postaInboxAttachments.mjs
  server/mailBodyParse.mjs
  src/components/posta/EkolojikPostaHubScreen.tsx
  scripts/sunucu-ekolojik-posta-parite-dogrula.sh
  scripts/sunucu-ekolojik-posta-kabul-sira.sh
)

for f in "${REQUIRED[@]}"; do
  if [[ -f "${REPO_ROOT}/${f}" ]]; then
    ok "${f}"
  else
    bad "eksik: ${f}"
  fi
done

echo ""
echo "--- TypeScript build ---"
if npm run build >/tmp/ek-kod-parite-build.log 2>&1; then
  ok "npm run build"
else
  bad "npm run build — tail /tmp/ek-kod-parite-build.log"
  tail -20 /tmp/ek-kod-parite-build.log || true
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "✓ Kod paritesi statik kapı geçti"
  exit 0
fi
exit 1
