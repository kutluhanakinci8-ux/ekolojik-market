import type { Store } from '../../store/useStore';
import {
  DEFAULT_ZYWELL_RECEIPT_PRINTER,
  normalizeReceiptPrinterSettings,
  type ReceiptPrinterBrand,
} from '../../types/receiptPrinter';

interface PosReceiptPrinterSettingsPanelProps {
  store: Store;
}

export function PosReceiptPrinterSettingsPanel({ store }: PosReceiptPrinterSettingsPanelProps) {
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
          Zywell varsayılanı
        </button>
      </div>

      <div className="settings-form-grid settings-form-grid--checks">
        <label className="settings-check">
          <input
            type="checkbox"
            checked={printer.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
          <span>Termal fiş yazdırma açık</span>
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
            placeholder="Örn. Zywell, ZYWEL ZY801"
          />
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
        Ayarlar bu mağaza (tenant) için sunucuda saklanır. Windows’ta Chrome → Yazdır → hedef olarak{' '}
        <strong>{printer.windowsPrinterName || 'Zywell'}</strong> seçili olmalı; ilk seferde “Varsayılan olarak
        kaydet” ile kasiyer profiline sabitlenir.
      </p>
    </section>
  );
}
