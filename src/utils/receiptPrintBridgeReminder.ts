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
    'Fiş doğrudan yazıcıya gönderilemedi (bu bilgisayarda fiş servisi kapalı).\n\n'
      + 'USB yazıcı hangi kasa PC/Mac’teyse, orada BİR KEZ otomatik kurulum yapın (her gün Terminal açmaya gerek yok):\n'
      + '• Mac: repo klasöründe → bash scripts/install-macos-receipt-bridge-launchd.sh\n'
      + '• Windows: Node.js LTS + PowerShell → scripts\\install-windows-receipt-bridge.ps1\n'
      + '• Sunucuda yazıcı varsa: deploy sonrası pm2 lima-receipt-bridge otomatik.\n\n'
      + 'Ayarlar → Fiş yazıcısı bölümünde adımlar ve test fiş var.',
  );
}
