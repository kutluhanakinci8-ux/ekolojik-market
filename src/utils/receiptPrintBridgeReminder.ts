const BRIDGE_KEY = 'market-pos-raw-bridge-reminder-v1';

/** Ham fiş köprüsü (127.0.0.1:18765) kapalı — tarayıcı diyaloğu açılmaz */
export function remindSilentReceiptBridgeMissing(): void {
  try {
    if (sessionStorage.getItem(BRIDGE_KEY)) return;
    sessionStorage.setItem(BRIDGE_KEY, '1');
  } catch {
    return;
  }
  window.alert(
    'Fiş doğrudan yazıcıya gönderilemedi (köprü kapalı).\n\n'
      + 'USB yazıcı hangi makinede, köprü ORADA çalışmalı:\n'
      + '• Windows kasa: scripts\\start-lima-receipt-bridge.bat\n'
      + '• Mac + USB: Terminal → node scripts/lima-raw-print-bridge.mjs\n'
      + '• Linux VPS (yazıcı sunucuda): cd repo && bash scripts/start-lima-receipt-bridge.sh\n'
      + '   veya: pm2 start lima-receipt-bridge (deploy sonrası)\n\n'
      + 'SSH sunucuda .bat / .ps1 ÇALIŞMAZ. Tarayıcı yazdır penceresi Lima’da açılmaz.',
  );
}
