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
import { getLastReceiptPrintError, getReceiptPrintLog } from '../../utils/receiptPrintLog';
import { loadTenantId } from '../../storage/tenantSession';
import { APP_BUILD_ID, APP_FEATURE_TAG } from '../../version';

function ReceiptPrintDebugBlock({ businessName }: { businessName: string }) {
  const [status, setStatus] = useState('');
  const tenant = loadTenantId();
  const logPath =
    tenant === 'main' || !tenant
      ? '/var/www/market-pos/data/receipt-print.log'
      : `/var/www/market-pos/data/tenants/${tenant}/receipt-print.log`;

  const runTest = async () => {
    setStatus('Test fiş gönderiliyor…');
    try {
      await printTestSaleReceipt(businessName);
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
      <button type="button" className="btn btn-outline" onClick={() => void runTest()}>
        Test fiş yazdır
      </button>
      {status ? <p className="module-hint">{status}</p> : null}
      <p className="module-hint">
        <strong>Tarayıcı:</strong> F12 → Konsol → <code>market-pos-fis</code> satırları.
        <br />
        <strong>Sunucu (SSH):</strong> <code>tail -f {logPath}</code>
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
          <strong>Lima Market</strong> — ayrı mağaza, <strong>limaadmin</strong> ile giriş. Satış sonrası
          otomatik <strong>premium</strong> termal fiş; yazıcı ayarı burada yok. Hedef: <strong>POS-80C</strong>,
          üst/alt bilgi kapalı, ölçek %100.
        </p>
        <ReceiptPrintDebugBlock businessName={store.settings.businessName} />
        <p className="module-hint muted" style={{ marginTop: 8, fontSize: 11 }}>
          Yüklü sürüm: {APP_FEATURE_TAG} · {APP_BUILD_ID}
          {APP_FEATURE_TAG !== 'receipt-print-debug' ? ' — sayfayı Cmd+Shift+R ile yenileyin' : null}
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
      <div className="settings-panel-head">
        <div>
          <h2>Fiş yazıcısı</h2>
          <p>Termal fiş (Zywell 80mm) — Windows’ta yazıcı adı Chrome ile eşleşmeli</p>
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
      <ReceiptPrintDebugBlock businessName={store.settings.businessName} />
    </section>
  );
}
