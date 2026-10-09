const REMINDER_KEY = 'market-pos-receipt-print-reminder-v2';

/** Chrome önizlemedeki URL/tarih şeridi — kullanıcı bir kez uyarılır */
export function remindChromeReceiptPrintSettings(): void {
  try {
    if (sessionStorage.getItem(REMINDER_KEY)) return;
    sessionStorage.setItem(REMINDER_KEY, '1');
  } catch {
    return;
  }
  window.alert(
    'Termal fiş (POS-80C) için Chrome yazdır penceresi:\n\n'
      + '1. «Daha az ayar» → Üstbilgi ve altbilgi KAPALI\n'
      + '2. Ölçek: %100 (sayfa genişliğine sığdır değil)\n'
      + '3. Hedef: Printer POS-80C\n'
      + '4. Kenar boşlukları: Yok / 0\n\n'
      + 'Üstte görünen site adresi Chrome’dan gelir; kapalı olmazsa fiş bozuk basılır.',
  );
}
