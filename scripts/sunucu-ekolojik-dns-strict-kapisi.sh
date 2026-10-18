#!/usr/bin/env bash
# Panelde TXT yayınlandıktan sonra strict=1 — yayılım için tekrar dene
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
TRIES="${EKOLOJIK_DNS_STRICT_TRIES:-24}"
SLEEP_SEC="${EKOLOJIK_DNS_STRICT_SLEEP:-60}"
SCRIPT="${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh"

echo "=== DNS strict kapısı (max ${TRIES} deneme, ${SLEEP_SEC}s aralık) ==="
for ((i = 1; i <= TRIES; i++)); do
  echo ""
  echo "--- Deneme ${i}/${TRIES} ---"
  if EKOLOJIK_DNS_STRICT=1 bash "${SCRIPT}"; then
    echo "✓ EKOLOJIK_DNS_STRICT=1 geçti"
    exit 0
  fi
  if [[ $i -lt TRIES ]]; then
    sleep "${SLEEP_SEC}"
  fi
done
echo "HATA: DNS strict hâlâ başarısız — Turhost panel kayıtlarını ve yayılımı kontrol edin"
echo "Öneriler: bash ${REPO_ROOT}/scripts/sunucu-ekolojik-dns-txt-onerileri.sh"
exit 1
