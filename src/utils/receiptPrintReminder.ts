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
    'Termal fiş — Chrome yazdır penceresi:\n\n'
      + '1. Hedef: «PDF olarak kaydet» DEĞİL → USB yazıcı (POS-80C / Zywell)\n'
      + '   (Liste boşsa: Mac Ayarlar → Yazıcılar, USB takılı mı; Chrome’u kapat-aç)\n'
      + '2. «Daha fazla ayar» → Üstbilgi ve altbilgi KAPALI\n'
      + '3. Ölçek %100, kenar 0\n\n'
      + 'Firefox’ta görünen yazıcı Chrome’da da sistem listesinden gelir; hedefi elle seçmek gerekir.',
  );
}
