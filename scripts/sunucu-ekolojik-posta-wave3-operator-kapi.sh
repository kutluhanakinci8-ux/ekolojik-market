#!/usr/bin/env bash
# Wave 3 — operatör kapanış kapısı (otomatik NB + IMAP; kısa manuel hatırlatma)
set -euo pipefail

INSTALL_DIR="${1:-/var/www/market-pos}"
REPO_ROOT="${EKOLOJIK_REPO_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

echo "=== Ekolojik Posta Wave 3 — operatör kapısı ==="
echo ""

bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-ui-yuruyus.sh" "${INSTALL_DIR}"

echo ""
echo "--- IMAP (Faz 7) ---"
if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-imap-dogrula.sh" "${INSTALL_DIR}"; then
  echo "OK   IMAP doğrulama"
else
  code=$?
  if [[ $code -eq 2 ]]; then
    echo "WARN IMAP yapılandırılmadı (opsiyonel)"
  else
    echo "HATA IMAP doğrulama (exit ${code})"
    exit "${code}"
  fi
fi

echo ""
cat <<'MANUAL'
--- Manuel POS (≈10 dk, docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md) ---
  #12 Gelen → konuşma modu → ilet / tümünü yanıtla
  #14 Gelen → çoklu seç → arşiv veya spam
  #17 Ağ kesintisi → offline son liste (PWA / SW)
MANUAL
echo ""
echo "✓ Wave 3 operatör otomatik kapısı tamam"
