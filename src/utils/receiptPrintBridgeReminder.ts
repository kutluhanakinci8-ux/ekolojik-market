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
      + 'Kasa PC’de bir kez kurun:\n'
      + '• Windows: scripts\\start-lima-receipt-bridge.bat (açık kalsın)\n'
      + '   veya scripts\\install-lima-bridge-windows-task.ps1 (otomatik başlatma)\n'
      + '• Sunucu deploy köprüsü: pm2 lima-receipt-bridge\n\n'
      + 'Tarayıcı «Yazdır» penceresi Lima’da açılmaz — yalnızca ham ESC/POS.',
  );
}
