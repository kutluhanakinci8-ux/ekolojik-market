#!/usr/bin/env bash
# Faz 5 checklist — otomatik ops adımları (DNS manuel kısmı + yedek + Faz 11 settings)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
export EKOLOJIK_VERIFY_BASE_URL="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:${PORT:-5180}}"

FAIL=0
ok() { echo "OK   $*"; }
warn() { echo "UYARI: $*"; }
bad() { echo "HATA: $*"; FAIL=1; }

echo "=== Ekolojik Faz 5 ops doğrulama (sıra 4) ==="
echo ""

echo "--- Yedek smoke ---"
if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-data-yedek.sh"; then
  ok "data yedek arşivi oluşturuldu"
else
  bad "data yedek"
fi
echo ""

echo "--- Günlük cron ---"
if [[ "$(id -u)" == "0" ]]; then
  if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-data-yedek-cron-kur.sh"; then
    ok "yedek cron"
  else
    bad "cron kurulumu"
  fi
else
  if [[ -f /etc/cron.d/ekolojik-market-data-backup ]]; then
    ok "cron dosyası mevcut (root kurulumu doğrulandı)"
  else
    warn "cron kurulu değil — root: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-data-yedek-cron-kur.sh"
  fi
fi
echo ""

echo "--- Posta panel ayarları (Faz 11) ---"
if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-settings-env-doldur.sh" "${INSTALL_DIR}"; then
  [[ -f "${INSTALL_DIR}/data/posta-mail-settings.json" ]] && ok "posta-mail-settings.json" || warn "settings dosyası yok"
else
  bad "posta settings env doldur"
fi
echo ""

echo ""
echo "DNS/DKIM (sıra 5): bash ${REPO_ROOT}/scripts/sunucu-ekolojik-dns-kabul-dogrula.sh"
echo ""

if [[ $FAIL -eq 0 ]]; then
  echo "✓ Faz 5 ops otomatik adımlar tamam (DNS + NB UI registrar/panel)"
  exit 0
fi
exit 1
