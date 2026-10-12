import { useState } from 'react';
import type { Store } from '../../store/useStore';
import {
  DEFAULT_ZYWELL_RECEIPT_PRINTER,
  normalizeReceiptPrinterSettings,
  type ReceiptPrinterBrand,
  type ReceiptPrintMode,
} from '../../types/receiptPrinter';
import { isPosLiteProfile } from '../../utils/tenantProductProfile';
import { printTestSaleReceipt } from '../../utils/receiptPrint';
import { isLimaRawPrintReadyForReceipt } from '../../utils/limaRawReceiptPrint';
import { getLastReceiptPrintError, getReceiptPrintLog } from '../../utils/receiptPrintLog';
import { loadTenantId } from '../../storage/tenantSession';
import { APP_BUILD_ID, APP_VERSION } from '../../version';
import { ReceiptBridgeAutostartHelp } from './ReceiptBridgeAutostartHelp';

function ReceiptPrintDebugBlock({
  businessName,
  windowsPrinterName,
}: {
  businessName: string;
  windowsPrinterName: string;
}) {
  const [status, setStatus] = useState('');
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  const tenant = loadTenantId();
  const logPath =
    tenant === 'main' || !tenant
      ? '/var/www/market-pos/data/receipt-print.log'
      : `/var/www/market-pos/data/tenants/${tenant}/receipt-print.log`;

  const checkBridge = async () => {
    const ready = await isLimaRawPrintReadyForReceipt();
    setBridgeOk(ready.bridgeUp);
    setStatus(ready.message);
    if (ready.bridgeUp && !ready.printerReady) {
      setStatus(
        `${ready.message}\n\nBluetoothta yalnizca "printer-80" varsa Windows’a yazici olarak ekleyin `
          + '(Ayarlar → Yazicilar) veya USB kullanin; sonra Ayarlar’daki yazici adini listedeki tam adla eslestirin.',
      );
    }
  };

  const runTest = async () => {
    setStatus('Test fiş gönderiliyor…');
    try {
      await printTestSaleReceipt(businessName, windowsPrinterName);
      const err = getLastReceiptPrintError();
      const tail = getReceiptPrintLog().slice(-5).map((e) => e.phase).join(' → ');
      setStatus(err ? `Hata: ${err}` : `Adımlar: ${tail}`);
    } catch (e) {
      setStatus(`Hata: ${String(e)}`);
    }
  };

  return (
    <div className="settings-subpanel" style={{ marginTop: 12 }}>
      <h3>Fiş teşhis</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline" onClick={() => void checkBridge()}>
          Köprü kontrol
        </button>
        <button type="button" className="btn btn-outline" onClick={() => void runTest()}>
          Test fiş yazdır
        </button>
      </div>
      {bridgeOk != null ? (
        <p className="module-hint">{bridgeOk ? '✓ http://127.0.0.1:18765 hazır' : '✗ Köprü yanıt vermiyor'}</p>
      ) : null}
      {status ? <p className="module-hint">{status}</p> : null}
      <p className="module-hint">
        <strong>Tarayıcı:</strong> F12 → Konsol → <code>market-pos-fis</code> satırları.
        <br />
        <strong>Sunucu (SSH):</strong> <code>tail -f {logPath}</code>
        <br />
        <strong>Windows yazıcı:</strong> PowerShell → <code>Get-Printer</code> (liste bos ise Bluetooth
        eslestirme yetmez; yazici sürücüsü ekleyin). <code>diag-windows-receipt-bridge.ps1</code>
        <br />
        <strong>Mac yazıcı:</strong> Terminal → <code>lpstat -p</code> ve{' '}
        <code>tail -f /var/log/cups/error_log</code>
        <br />
        <strong>Önizleme bozuksa:</strong> üst/alt bilgi <strong>kapalı</strong>, ölçek <strong>%100</strong>.
        <br />
        <strong>Chrome:</strong> Hedef <strong>POS-80C</strong>. Kağıt boyutu küçük kare (2,125 inç) ise
        Mac’te yazıcıya <strong>80mm termal rulo</strong> tanımlayın; Chrome’da en geniş rulo seçin.
        <code>lpstat -p -d</code>
      </p>
    </div>
  );
}

interface PosReceiptPrinterSettingsPanelProps {
  store: Store;
}

export function PosReceiptPrinterSettingsPanel({ store }: PosReceiptPrinterSettingsPanelProps) {
  if (isPosLiteProfile(store.settings)) {
    return (
      <section className="settings-panel settings-panel--receipt-printer">
        <h2>Fiş yazıcısı</h2>
        <p className="module-hint">
          <strong>Lima Market</strong> — fiş <strong>doğrudan POS-80C</strong> (ESC/POS); tarayıcı yazdır penceresi{' '}
          <strong>açılmaz</strong>. Kasa PC’de fiş servisi <strong>bir kez</strong> kurulur, sonra otomatik çalışır.
        </p>
        <ReceiptBridgeAutostartHelp />
        <ReceiptPrintDebugBlock
          businessName={store.settings.businessName}
          windowsPrinterName={
            normalizeReceiptPrinterSettings(store.settings.receiptPrinter).windowsPrinterName ||
            'Printer POS-80C'
          }
        />
        <p className="module-hint muted" style={{ marginTop: 8, fontSize: 11 }}>
          Yüklü sürüm: {APP_VERSION} · derleme {APP_BUILD_ID}
        </p>
      </section>
    );
  }

  const printer = normalizeReceiptPrinterSettings(store.settings.receiptPrinter);

  const set = (patch: Partial<typeof printer>) => {
    store.updateReceiptPrinterSettings(patch);
  };

  const applyZywellPreset = () => {
    store.updateReceiptPrinterSettings({ ...DEFAULT_ZYWELL_RECEIPT_PRINTER });
  };

  return (
    <section className="settings-panel settings-panel--receipt-printer">
      <ReceiptBridgeAutostartHelp />
      <div className="settings-panel-head">
        <div>
          <h2>Fiş yazıcısı</h2>
          <p>Termal fiş (POS-80C) — sessiz yazdırma; kasada otomatik fiş servisi kurulumu yukarıda</p>
        </div>
        <button type="button" className="btn btn-outline" onClick={applyZywellPreset}>
          POS-80C / Zywell varsayılanı
        </button>
      </div>

      <div className="settings-form-grid settings-form-grid--checks">
        <label className="settings-check">
          <input
            type="checkbox"
            checked={printer.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          <span>Gelişmiş fiş profili (kapalı = Greenleaf kasa yolu, önerilen)</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={printer.autoPrintOnSale}
            onChange={(e) => set({ autoPrintOnSale: e.target.checked })}
          />
          <span>Satış sonrası otomatik fiş</span>
        </label>
        <label className="settings-field">
          <span>Marka</span>
          <select
            value={printer.brand}
            onChange={(e) => set({ brand: e.target.value as ReceiptPrinterBrand })}
          >
            <option value="none">Kapalı / tarayıcı varsayılanı</option>
            <option value="zywell">Zywell</option>
            <option value="generic">Diğer termal</option>
          </select>
        </label>
        <label className="settings-field">
          <span>Windows yazıcı adı</span>
          <input
            value={printer.windowsPrinterName}
            onChange={(e) => set({ windowsPrinterName: e.target.value })}
            placeholder="Örn. POS-80C, Zywell"
          />
        </label>
        <label className="settings-field">
          <span>Fiş formatı</span>
          <select
            value={printer.printMode}
            onChange={(e) => set({ printMode: e.target.value as ReceiptPrintMode })}
          >
            <option value="plain">Düz metin (Zywell — önerilen)</option>
            <option value="html">HTML tablo</option>
          </select>
        </label>
        <label className="settings-field">
          <span>Kağıt genişliği</span>
          <select
            value={String(printer.paperWidthMm)}
            onChange={(e) => set({ paperWidthMm: e.target.value === '58' ? 58 : 80 })}
          >
            <option value="80">80 mm</option>
            <option value="58">58 mm</option>
          </select>
        </label>
        <label className="settings-field">
          <span>Kopya sayısı</span>
          <input
            type="number"
            min={1}
            max={3}
            value={printer.copies}
            onChange={(e) => set({ copies: parseInt(e.target.value, 10) || 1 })}
          />
        </label>
      </div>
      <p className="module-hint">
        <strong>Kapalı</strong> bırakın: diğer kullanıcıdaki (yonetici) gibi HTML fiş + Chrome + POS-80C.
        Sadece özel ihtiyaçta açın. Chrome: hedef POS-80C, üst/alt bilgiler kapalı, kenar yok, sayfa genişliğine sığdır.
      </p>
      <ReceiptPrintDebugBlock
        businessName={store.settings.businessName}
        windowsPrinterName={printer.windowsPrinterName || 'Printer POS-80C'}
      />
    </section>
  );
}
