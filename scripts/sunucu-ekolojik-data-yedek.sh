#!/usr/bin/env bash
# Faz 5 — Ekolojik data yedek (outbox, messaging, bill inbox, contact)
# Cron: 0 3 * * * root bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-data-yedek.sh
set -euo pipefail

DATA_DIR="${MARKET_POS_DATA:-/var/www/market-pos/data}"
BACKUP_ROOT="${EKOLOJIK_BACKUP_DIR:-/var/backups/ekolojik-market}"
STAMP="$(date +%Y-%m-%d_%H%M)"
ARCHIVE="${BACKUP_ROOT}/ekolojik-data-${STAMP}.tar.gz"

mkdir -p "${BACKUP_ROOT}"

INCLUDE=()
for name in email-outbox messaging bill-email-inbox messaging-attachments contact-messages.json posta-mail-settings.json; do
  if [[ -e "${DATA_DIR}/${name}" ]]; then
    INCLUDE+=("${name}")
  fi
done

if [[ ${#INCLUDE[@]} -eq 0 ]]; then
  echo "UYARI: yedeklenecek dosya yok (${DATA_DIR})"
  exit 0
fi

tar czf "${ARCHIVE}" -C "${DATA_DIR}" "${INCLUDE[@]}"
echo "OK  ${ARCHIVE} ($(du -h "${ARCHIVE}" | awk '{print $1}'))"
find "${BACKUP_ROOT}" -name 'ekolojik-data-*.tar.gz' -mtime +14 -delete 2>/dev/null || true
