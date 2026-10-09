const REMINDER_KEY = 'market-pos-receipt-print-reminder-v6';

/** Chrome önizlemedeki URL/tarih şeridi — kullanıcı bir kez uyarılır */
export function remindChromeReceiptPrintSettings(): void {
  try {
    if (sessionStorage.getItem(REMINDER_KEY)) return;
    sessionStorage.setItem(REMINDER_KEY, '1');
  } catch {
    return;
  }
  window.alert(
    'Termal fiş — tarayıcı yazdır penceresi (Firefox / Chrome):\n\n'
      + '1. Hedef: «PDF olarak kaydet» DEĞİL → USB yazıcı (POS-80C / Zywell)\n'
      + '   (Liste boşsa: Mac Ayarlar → Yazıcılar, USB takılı mı; Chrome’u kapat-aç)\n'
      + '2. «Daha fazla ayar» → «Üst bilgi ve alt bilgileri yazdır» KAPALI (işaretli olursa fiş kayar/kesilir)\n'
      + '3. ÖLÇEK (zorunlu): tam %100 — 89 veya «sayfa genişliğine sığdır» OLMAZ\n'
      + '   (Silik basım + erken kesik fiş genelde buradan.)\n'
      + '4. Kenar boşluk: Yok\n'
      + '5. Kağıt boyutu: 80×3276 mm rulo (X80mmY3276mm) — ~210 mm «custom» seçiliyse '
      + 'fiş önizlemede tam görünür ama yazıcı birkaç mm kesik basabilir.\n'
      + '   Mac: lpoptions -p Printer_POS_80C -o PageSize=X80mmY3276mm\n\n'
      + 'Önizleme ortada küçük kare görünüyorsa kağıt boyutu yanlıştır; fiş metni doğru olsa bile basım bozulur.',
  );
}
