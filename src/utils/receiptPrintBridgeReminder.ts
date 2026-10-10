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
    'Sessiz fiş yazdırılamadı — yerel köprü çalışmıyor.\n\n'
      + 'Kasa bilgisayarında (POS-80C takılı) bir kez başlatın:\n'
      + '• Windows: scripts\\start-lima-receipt-bridge.bat\n'
      + '• Mac: node scripts/lima-raw-print-bridge.mjs\n\n'
      + 'Pencere açık kalsın. Sonra test satışı yapın — Firefox/Chrome yazdır diyaloğu açılmaz.',
  );
}
