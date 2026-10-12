/** Fiş köprüsü — kasa PC’de bir kez kurulum (müşteri her gün Terminal açmaz) */
export function ReceiptBridgeAutostartHelp() {
  return (
    <div className="settings-subpanel receipt-bridge-autostart">
      <h3>Otomatik fiş servisi (bir kez kurulum)</h3>
      <p className="module-hint">
        Site buluttan açılır; yazıcı USB ile <strong>bu kasa bilgisayarına</strong> bağlıdır. Fiş servisi
        bilgisayar açıldığında arka planda çalışır — satışta tarayıcı <code>127.0.0.1:18765</code> adresine bağlanır.
      </p>
      <ul className="module-hint receipt-bridge-steps">
        <li>
          <strong>Mac (Printer_POS_80C):</strong> projeyi bir kez indirin, Terminal’de:
          <pre className="receipt-bridge-cmd">cd ekolojik-market
export POS80_QUEUE_NAME=&quot;Printer_POS_80C&quot;
bash scripts/install-macos-receipt-bridge-launchd.sh</pre>
        </li>
        <li>
          <strong>Windows:</strong> PowerShell (yönetici değil, normal kullanıcı):
          <pre className="receipt-bridge-cmd">cd C:\...\ekolojik-market
.\scripts\install-lima-bridge-windows-task.ps1 -PrinterName &quot;Printer POS-80C&quot;</pre>
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
