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
      + '3. Ölçek %100, kenar boşluk: Yok\n'
      + '4. Kağıt boyutu: «2,125 x 2,75 inç» etiket DEĞİL — 80mm/58mm rulo veya '
      + 'en geniş rulo seçeneği (Mac: Sistem Ayarları → Yazıcılar → POS-80C → varsayılan kağıt)\n\n'
      + 'Önizleme ortada küçük kare görünüyorsa kağıt boyutu yanlıştır; fiş metni doğru olsa bile basım bozulur.',
  );
}
