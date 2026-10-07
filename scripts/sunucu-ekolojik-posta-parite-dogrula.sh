#!/usr/bin/env bash
# Faz 12 — Posta & mesaj NB-parite smoke (VPS veya CI)
# SMTP, hub API, badge, export uçları — tam webmail değil, Ekolojik hedef kapsamı
set -euo pipefail

ROOT="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
ENV_FILE="${ROOT}/.env"
BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"

FAIL=0
warn() { echo "UYARI: $*"; }
ok() { echo "OK   $*"; }
bad() { echo "HATA: $*"; FAIL=1; }

echo "=== Ekolojik Posta parite doğrulama (Faz 12 + 14–21 API) ==="
echo "Kök: ${ROOT}"
echo "API:  ${BASE_URL}"

if [[ ! -f "${ENV_FILE}" ]]; then
  bad "${ENV_FILE} yok"
else
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  # shellcheck source=scripts/lib/ekolojik-env-load.sh
  source "${SCRIPT_DIR}/lib/ekolojik-env-load.sh"
  set -a
  ekolojik_load_env "${ENV_FILE}"
  set +a
  if [[ "${LERTA_PLATFORM_BRIDGE:-0}" != "0" ]]; then
    warn "LERTA_PLATFORM_BRIDGE=${LERTA_PLATFORM_BRIDGE:-} — Ekolojik bağımsızlık için 0 olmalı"
  else
    ok "LERTA_PLATFORM_BRIDGE=0"
  fi
fi

if ! curl -fsS "${BASE_URL}/api/email/health" -o /tmp/ek-posta-health.json 2>/dev/null; then
  bad "/api/email/health yanıt yok — pm2 status market-pos"
else
  node -e "
const j=require('/tmp/ek-posta-health.json');
if (!j.ok) { console.error('health ok=false'); process.exit(1); }
console.log('smtpConfigured', j.smtpConfigured, 'verified', j.smtpVerified);
if (j.smtpHostHint) console.log('hint', j.smtpHostHint);
if (!j.smtpConfigured) process.exit(2);
if (!j.smtpVerified) process.exit(3);
" && ok "SMTP health" || {
    code=$?
    if [[ $code -eq 2 ]]; then warn "SMTP yapılandırılmadı (Faz 6)"; FAIL=1; fi
    if [[ $code -eq 3 ]]; then warn "SMTP doğrulanamadı — sunucu-ekolojik-smtp-dogrula.sh"; FAIL=1; fi
  }
fi

if curl -fsS "${BASE_URL}/api/posta/imap/health" -o /tmp/ek-imap-health.json 2>/dev/null; then
  node -e "
const j=require('/tmp/ek-imap-health.json');
if (j.imapConfigured && j.imapVerified) process.exit(0);
if (!j.imapConfigured) process.exit(2);
process.exit(3);
" && ok "IMAP health" || {
    code=$?
    if [[ $code -eq 2 ]]; then warn "IMAP yapılandırılmadı (Faz 7 opsiyonel)"; fi
    if [[ $code -eq 3 ]]; then warn "IMAP bağlantısı yok — sunucu-ekolojik-imap-dogrula.sh"; FAIL=1; fi
  }
fi

for path in \
  "/api/posta/unread-counts" \
  "/api/posta/inbox?folder=gelen&limit=5" \
  "/api/posta/inbox?folder=fatura&limit=5" \
  "/api/posta/inbox?folder=spam&limit=5" \
  "/api/posta/inbox?folder=yildizli&limit=3" \
  "/api/posta/inbox/search?folder=gelen&q=test&limit=3" \
  "/api/posta/sent?limit=3" \
  "/api/posta/storage" \
  "/api/posta/rules" \
  "/api/posta/rules/capabilities" \
  "/api/posta/outbox/analytics?days=7" \
  "/api/posta/engagement/summary?days=7" \
  "/api/posta/push/config" \
  "/api/posta/deliverability" \
  "/api/posta/notifications/matrix" \
  "/api/posta/compose/rte-capabilities" \
  "/api/posta/drafts" \
  "/api/posta/contacts?limit=5" \
  "/api/posta/calendar" \
  "/api/posta/calendar/sync" \
  "/api/posta/settings" \
  "/api/posta/templates" \
  "/api/posta/compose-hints?limit=5" \
  "/api/messaging/threads?limit=5" \
  "/api/system/ekolojik-isolation"; do
  if curl -fsS "${BASE_URL}${path}" -o "/tmp/ek-posta-check.json" 2>/dev/null; then
    ok "GET ${path}"
  else
    bad "GET ${path} başarısız"
  fi
done

if curl -fsS "${BASE_URL}/api/posta/export/outbox.csv" -o /tmp/ek-outbox.csv 2>/dev/null; then
  lines=$(wc -l < /tmp/ek-outbox.csv || echo 0)
  ok "export outbox.csv (${lines} satır)"
else
  bad "GET /api/posta/export/outbox.csv"
fi

if curl -fsS "${BASE_URL}/api/messaging/export" -o /tmp/ek-msg-export.bin 2>/dev/null; then
  size=$(wc -c < /tmp/ek-msg-export.bin || echo 0)
  ok "export messaging (${size} bayt)"
else
  bad "GET /api/messaging/export"
fi

# SSE: retry + unread veya ping (5 sn)
SSE_HEAD="$(timeout 5 curl -fsS -N "${BASE_URL}/api/posta/events" 2>/dev/null | head -n 8 || true)"
if echo "$SSE_HEAD" | grep -q '^retry:' && echo "$SSE_HEAD" | grep -qE '^event:( unread| ping)'; then
  ok "SSE /api/posta/events (retry + event)"
elif echo "$SSE_HEAD" | grep -q '^event:'; then
  ok "SSE /api/posta/events"
else
  warn "SSE kısa test — bağlantı veya proxy SSE'yi kesiyor olabilir"
fi

if curl -fsS "${BASE_URL}/api/posta/live/capabilities" -o /tmp/ek-posta-live-cap.json 2>/dev/null; then
  if node -e "const d=require('/tmp/ek-posta-live-cap.json'); process.exit(d.ok&&d.events?.includes('ping')?0:1)"; then
    ok "GET /api/posta/live/capabilities"
  else
    bad "live capabilities içerik hatası"
  fi
else
  bad "GET /api/posta/live/capabilities"
fi

if curl -fsS "${BASE_URL}/posta-offline-sw.js" -o /tmp/ek-posta-sw.js 2>/dev/null; then
  if head -1 /tmp/ek-posta-sw.js | grep -q 'posta'; then
    ok "offline SW (Faz 21)"
  fi
fi

SMTP_SCRIPT="${REPO_ROOT}/scripts/sunucu-ekolojik-smtp-dogrula.sh"
if [[ -f "${SMTP_SCRIPT}" ]]; then
  if bash "${SMTP_SCRIPT}" "${ROOT}"; then
    ok "SMTP alt script"
  else
    warn "SMTP alt script başarısız (exit $?)"
    FAIL=1
  fi
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "✓ Posta parite doğrulama geçti (Faz 12 + 14–21 API)"
  exit 0
fi
echo "✗ Bazı kontroller başarısız — docs/EKOLOJIK-POSTA-E2E-SMOKE.md"
exit 1
