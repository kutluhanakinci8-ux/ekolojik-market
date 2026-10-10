#!/usr/bin/env bash
# Mac POS-80C — tek satir metin testi
set -euo pipefail
QUEUE="${POS80_QUEUE_NAME:-Printer_POS_80C}"
printf 'LIMA TEST\n' | lp -d "$QUEUE"
echo "Kuyruk: $QUEUE — fis basinda sadece «LIMA TEST» olmali."
