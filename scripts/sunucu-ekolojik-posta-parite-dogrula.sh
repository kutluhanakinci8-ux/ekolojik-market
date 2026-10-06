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

echo "=== Ekolojik Posta parite doğrulama (Faz 12) ==="
echo "Kök: ${ROOT}"
echo "API:  ${BASE_URL}"

if [[ ! -f "${ENV_FILE}" ]]; then
  bad "${ENV_FILE} yok"
else
  # shellcheck disable=SC1090
  set -a
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
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

for path in \
  "/api/posta/unread-counts" \
  "/api/posta/inbox?folder=gelen&limit=5" \
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

# SSE: ilk satır okunabiliyor mu (3 sn)
if timeout 3 curl -fsS -N "${BASE_URL}/api/posta/events" 2>/dev/null | head -n 1 | grep -q event:; then
  ok "SSE /api/posta/events"
else
  warn "SSE kısa test — bağlantı veya proxy SSE'yi kesiyor olabilir"
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
  echo "✓ Posta parite doğrulama geçti (Ekolojik SMB kapsamı)"
  exit 0
fi
echo "✗ Bazı kontroller başarısız — docs/EKOLOJIK-POSTA-E2E-SMOKE.md"
exit 1
