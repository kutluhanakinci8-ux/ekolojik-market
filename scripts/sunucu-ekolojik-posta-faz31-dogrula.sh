#!/usr/bin/env bash
# Faz 31 — NB PM-9 kurallar G5+ (OR grupları, ek boyutu)
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 31 doğrulama ==="
test -f "${ROOT}/server/postaRules.mjs" || exit 1

curl -fsS "${BASE}/api/posta/rules/capabilities" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.features?.includes('matchGroupsOr')) process.exit(1);
console.log('OK   rules capabilities v', d.version);
"

cd "${ROOT}"
node --input-type=module -e "
import { ruleMatchesMessage } from './server/postaRules.mjs';
const rule = {
  enabled: true,
  matchGroups: [
    { subjectContains: 'fatura', fromContains: '' },
    { subjectContains: '', fromContains: 'billing@' },
  ],
  minAttachmentBytes: 100,
  maxAttachmentBytes: null,
};
if (!ruleMatchesMessage(rule, { subject: 'e-fatura', from: 'a@b.com', attachments: [{ size: 200 }] })) process.exit(1);
if (ruleMatchesMessage(rule, { subject: 'x', from: 'a@b.com', attachments: [{ size: 50 }] })) process.exit(1);
console.log('OK   rule engine OR + min attachment');
"

echo "✓ Faz 31 doğrulama geçti"
