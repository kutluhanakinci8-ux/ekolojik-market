#!/usr/bin/env bash
# NB parite boşlukları — P1 public API, P2 köprüler, P3 public mail / tenant
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta NB gap doğrulama (P1–P3 lite) ==="

curl -fsS "${BASE}/api/public/messaging/v1/capabilities" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok||!d.apiPrefix) process.exit(1);
console.log('OK   public messaging capabilities');
"

curl -fsS "${BASE}/api/public/mail/v1/capabilities" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok||!d.apiPrefix) process.exit(1);
console.log('OK   public mail capabilities');
"

curl -fsS "${BASE}/api/posta/jmap-lite/session" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok||!d.capabilities) process.exit(1);
console.log('OK   JMAP lite session');
"

curl -fsS "${BASE}/api/posta/caldav-lite/principal" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok||!d.calendarHome) process.exit(1);
console.log('OK   CalDAV lite principal');
"

curl -fsS "${BASE}/api/posta/tenants" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok||!Array.isArray(d.tenants)) process.exit(1);
console.log('OK   tenant list', d.tenants.join(','));
"

test -f "${ROOT}/public/ekolojik-messaging-widget.js" || exit 1
echo "OK   messaging widget static"

echo "✓ NB gap doğrulama geçti"
