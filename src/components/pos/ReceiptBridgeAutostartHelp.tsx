/** Fiş köprüsü — kasa PC’de bir kez kurulum (müşteri her gün Terminal açmaz) */
export function ReceiptBridgeAutostartHelp() {
  return (
    <div className="settings-subpanel receipt-bridge-autostart">
      <h3>Otomatik fiş servisi (bir kez kurulum)</h3>
      <p className="module-hint">
        Site buluttan açılır; yazıcı USB ile <strong>bu kasa bilgisayarına</strong> bağlıdır. Kurulum dosyası
        fiş servisini <strong>arka planda</strong> kaydeder (pencere açılmaz); her oturum açılışında otomatik
        çalışır — tarayıcı <code>127.0.0.1:18765</code> adresine bağlanır.
        Mağaza adresi: <strong>https://www.ekolojikmarket.com.tr/app</strong> (tek site; eski adres otomatik yönlenir).
      </p>
      <ul className="module-hint receipt-bridge-steps">
        <li>
          <strong>Mac (Printer_POS_80C):</strong> projeyi bir kez indirin, Terminal’de:
          <pre className="receipt-bridge-cmd">cd ekolojik-market
export POS80_QUEUE_NAME=&quot;Printer_POS_80C&quot;
bash scripts/install-macos-receipt-bridge-launchd.sh</pre>
        </li>
        <li>
          <strong>Windows — Zywell POS-80 (standart):</strong> Ayarlar → Fiş yazıcısı →{' '}
          <strong>«Windows — Zywell otomatik kurulum (.ps1)»</strong> indirin; PowerShell ile bir kez çalıştırın
          (Node.js LTS). Yazıcı adı: <code>Ekolojik POS-80 (Zywell)</code>. Repo varsa:{' '}
          <code>.\scripts\install-windows-receipt-bridge.ps1</code>
        </li>
        <li>
          <strong>Test:</strong> Ayarlar → Fiş teşhis → «Köprü kontrol» → «Test fiş yazdır».
        </li>
      </ul>
      <p className="module-hint muted">
        Sunucu (VPS) deploy: <code>pm2</code> ile <code>lima-receipt-bridge</code> otomatik başlar — yalnızca yazıcı
        sunucuya USB bağlıysa işe yarar.
      </p>
    </div>
  );
}
