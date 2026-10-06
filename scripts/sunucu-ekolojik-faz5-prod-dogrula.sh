#!/usr/bin/env bash
# Faz 5 üretim — otomatik doğrulanabilir maddeler (DNS/KVKK/cron manuel kalır)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
DATA_DIR="${INSTALL_DIR}/data"
PORT="${PORT:-5180}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT}}"

FAIL=0
warn() { echo "UYARI: $*"; }
ok() { echo "OK   $*"; }
bad() { echo "HATA: $*"; FAIL=1; }

echo "=== Ekolojik Faz 5 prod doğrulama (otomatik) ==="
echo "Runtime: ${INSTALL_DIR}"
echo ""

if [[ -f /var/run/reboot-required ]]; then
  warn "Sistem yeniden başlatma bekliyor (/var/run/reboot-required) — bakım penceresinde reboot"
fi

if command -v pm2 >/dev/null 2>&1; then
  if pm2 jlist 2>/dev/null | grep -q '"name":"market-pos"'; then
    ok "pm2 market-pos kayıtlı (ayrı process)"
  else
    bad "pm2 market-pos yok"
  fi
else
  warn "pm2 yok — process kontrolü atlandı"
fi

if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-env-audit.sh" "${INSTALL_DIR}"; then
  ok "env audit"
else
  FAIL=1
fi
echo ""

if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-prod-kapat.sh" "${INSTALL_DIR}"; then
  ok "posta prod kapatma"
else
  FAIL=1
fi
echo ""

if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-smtp-dogrula.sh" "${INSTALL_DIR}"; then
  ok "SMTP doğrulama (Faz 6)"
else
  FAIL=1
fi

HEALTH="$(curl -fsS "${EKOLOJIK_VERIFY_BASE_URL}/api/email/health" 2>/dev/null || echo '{}')"
echo "${HEALTH}" | node -e "
const j=JSON.parse(require('fs').readFileSync(0,'utf8'));
const failed=j.counts?.failed??-1;
if (failed>0) { console.error('outbox failed', failed); process.exit(1); }
console.log('outbox failed', failed);
" && ok "outbox failed=0" || bad "outbox failed > 0 — Ayarlar paneli / retry"

ISO="$(curl -fsS "${EKOLOJIK_VERIFY_BASE_URL}/api/system/ekolojik-isolation" 2>/dev/null || echo '{}')"
echo "${ISO}" | grep -q '"ok":true' && ok "ekolojik isolation API" || bad "isolation API"

for path in messaging email-outbox; do
  if [[ -d "${DATA_DIR}/${path}" ]]; then
    ok "data/${path}/ mevcut"
  else
    warn "data/${path}/ yok (henüz kullanılmamış olabilir)"
  fi
done

[[ -f "${DATA_DIR}/posta-mail-settings.json" ]] && ok "posta-mail-settings.json" || warn "posta-mail-settings.json yok (Faz 11 varsayılan)"

if curl -fsS "${EKOLOJIK_VERIFY_BASE_URL}/api/messaging/export" -o /tmp/ek-messaging-export.zip 2>/dev/null; then
  sz="$(wc -c </tmp/ek-messaging-export.zip | tr -d ' ')"
  ok "messaging export ZIP (${sz} bayt)"
else
  bad "messaging export"
fi

if [[ -x "${REPO_ROOT}/scripts/sunucu-ekolojik-data-yedek.sh" ]]; then
  ok "yedek script hazır (cron: docs/EKOLOJIK-FAZ5-PROD-CHECKLIST.md)"
else
  warn "sunucu-ekolojik-data-yedek.sh bulunamadı"
fi

if [[ "${EKOLOJIK_RUN_E2E:-0}" == "1" ]]; then
  echo ""
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-e2e-tam.sh" "${INSTALL_DIR}" || FAIL=1
fi

echo ""
echo "Manuel (checklist): SPF/DKIM/DMARC, fatura IMAP, NB UI 30 dk — docs/EKOLOJIK-FAZ5-PROD-CHECKLIST.md"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo "✓ Faz 5 otomatik kapı geçti"
  exit 0
fi
echo "HATA: Faz 5 otomatik doğrulama — yukarıdaki HATA satırları"
exit 1
