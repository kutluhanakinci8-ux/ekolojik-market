#!/usr/bin/env bash
# Lima — sessiz termal fiş köprüsü (Linux / macOS VPS veya kasa)
#   bash scripts/start-lima-receipt-bridge.sh
# Yazıcı kuyruğu (CUPS): export POS80_QUEUE_NAME=Printer_POS_80C
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"
export POS80_QUEUE_NAME="${POS80_QUEUE_NAME:-Printer_POS_80C}"
export LIMA_RAW_PRINT_PORT="${LIMA_RAW_PRINT_PORT:-18765}"
echo "Lima fiş köprüsü — kuyruk=${POS80_QUEUE_NAME} port=${LIMA_RAW_PRINT_PORT}"
exec node scripts/lima-raw-print-bridge.mjs
