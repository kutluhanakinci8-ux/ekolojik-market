/** Fiş köprüsü — kasa PC’de bir kez kurulum (müşteri her gün Terminal açmaz) */
export function ReceiptBridgeAutostartHelp() {
  return (
    <div className="settings-subpanel receipt-bridge-autostart">
      <h3>Otomatik fiş servisi (bir kez kurulum)</h3>
      <p className="module-hint">
        Site buluttan açılır; yazıcı USB ile <strong>bu kasa bilgisayarına</strong> bağlıdır. Fiş servisi
        bilgisayar açıldığında arka planda çalışır — satışta tarayıcı <code>127.0.0.1:18765</code> adresine bağlanır.
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
          <strong>Windows (USB yazıcı bu PC’de):</strong> Node.js LTS kurulu olmalı. PowerShell (yönetici gerekmez):
          <pre className="receipt-bridge-cmd">cd C:\...\ekolojik-market
.\scripts\install-windows-receipt-bridge.ps1
.\scripts\diag-windows-receipt-bridge.ps1</pre>
          Yazıcı adı Ayarlar → Fiş yazıcısı ile Windows «Yazıcılar» listesindeki <strong>tam ad</strong> aynı olmalı
          (ör. <code>POS-80C</code> veya <code>Printer POS-80C</code>). Siteyi sadece tarayıcıda açmak yetmez — köprü bu bilgisayarda kurulmalı.
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
