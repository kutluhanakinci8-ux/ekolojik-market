#!/usr/bin/env bash
# Greenleaf / Lima — fiş köprüsünü macOS oturum açılışında otomatik başlatır (Terminal gerekmez).
# Bir kez çalıştırın (kasa Mac, USB POS-80C bağlı):
#   cd /path/to/ekolojik-market && bash scripts/install-macos-receipt-bridge-launchd.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$(command -v node)"
QUEUE="${POS80_QUEUE_NAME:-Printer_POS_80C}"
LABEL="com.greenleaf.market.receipt-bridge"
DEST_DIR="${HOME}/.greenleaf-market-pos"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

if [[ -z "${NODE_BIN}" ]]; then
  echo "HATA: node bulunamadı — https://nodejs.org kurun veya brew install node"
  exit 1
fi

mkdir -p "${DEST_DIR}" "${HOME}/Library/LaunchAgents"
cp "${REPO_ROOT}/scripts/lima-raw-print-bridge.mjs" "${DEST_DIR}/lima-raw-print-bridge.mjs"
cp "${REPO_ROOT}/scripts/escposTurkish.mjs" "${DEST_DIR}/escposTurkish.mjs"
if [[ -f "${REPO_ROOT}/scripts/win-raw-escpos.ps1" ]]; then
  cp "${REPO_ROOT}/scripts/win-raw-escpos.ps1" "${DEST_DIR}/" 2>/dev/null || true
fi

cat > "${PLIST}" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${DEST_DIR}/lima-raw-print-bridge.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${DEST_DIR}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>POS80_QUEUE_NAME</key>
    <string>${QUEUE}</string>
    <key>LIMA_RAW_PRINT_PORT</key>
    <string>18765</string>
  </dict>
  <key>StandardOutPath</key>
  <string>${DEST_DIR}/bridge.log</string>
  <key>StandardErrorPath</key>
  <string>${DEST_DIR}/bridge.err.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "${PLIST}" 2>/dev/null || launchctl load "${PLIST}" 2>/dev/null || true
launchctl enable "gui/$(id -u)/${LABEL}" 2>/dev/null || true
launchctl kickstart -k "gui/$(id -u)/${LABEL}" 2>/dev/null || true

sleep 1
if curl -fsS "http://127.0.0.1:18765/health" | grep -q '"ok"'; then
  echo "✓ Fiş servisi çalışıyor (127.0.0.1:18765, kuyruk: ${QUEUE})"
  echo "  Log: ${DEST_DIR}/bridge.log"
else
  echo "UYARI: Servis yüklendi ama health yanıt vermedi — lpstat -p ve log dosyasını kontrol edin."
fi
