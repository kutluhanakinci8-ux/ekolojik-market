import type { Store } from '../../store/useStore';
import { DEFAULT_POS_CHECKOUT_SETTINGS, type PosCheckoutSettings } from '../../types/pos';

interface PosCheckoutSettingsPanelProps {
  store: Store;
}

export function PosCheckoutSettingsPanel({ store }: PosCheckoutSettingsPanelProps) {
  const pos = { ...DEFAULT_POS_CHECKOUT_SETTINGS, ...store.settings.posCheckout };

  const set = (patch: Partial<PosCheckoutSettings>) => {
    store.updatePosCheckoutSettings(patch);
  };

  return (
    <section className="settings-panel settings-panel--pos-checkout">
      <div className="settings-panel-head">
        <div>
          <h2>POS & Kasa hızı</h2>
          <p>Barkod, fiş zamanlaması ve kapalı gün kuralı</p>
        </div>
      </div>

      <div className="settings-form-grid settings-form-grid--checks">
        <label className="settings-check">
          <input
            type="checkbox"
            checked={pos.blockSalesWhenDayClosed ?? true}
            onChange={(e) => set({ blockSalesWhenDayClosed: e.target.checked })}
          />
          <span>Kasa günü kapalıysa satışı engelle</span>
        </label>
        <label className="settings-check">
          <input
            type="checkbox"
            checked={pos.hideGridWhenSearching ?? true}
            onChange={(e) => set({ hideGridWhenSearching: e.target.checked })}
          />
          <span>Arama/barkod varken ürün gridini gizle</span>
        </label>
        <label className="settings-field">
          <span>Ürün grid sayfa boyutu</span>
          <input
            type="number"
            min={12}
            max={120}
            value={pos.productGridPageSize ?? 30}
            onChange={(e) => set({ productGridPageSize: parseInt(e.target.value, 10) || 30 })}
          />
        </label>
        <label className="settings-field">
          <span>Fiş zamanlaması</span>
          <select
            value={pos.fiscalTiming ?? 'after_sale'}
            onChange={(e) => set({ fiscalTiming: e.target.value as PosCheckoutSettings['fiscalTiming'] })}
          >
            <option value="after_sale">Önce satış kaydı, sonra fiş (hızlı)</option>
            <option value="before_sale">Önce yazar kasa, sonra satış</option>
          </select>
        </label>
        <label className="settings-field">
          <span>Yazar kasa hatası</span>
          <select
            value={pos.fiscalFailMode ?? 'continue'}
            onChange={(e) => set({ fiscalFailMode: e.target.value as PosCheckoutSettings['fiscalFailMode'] })}
          >
            <option value="continue">Uyarı ver, satışa devam et</option>
            <option value="confirm">Onay iste</option>
          </select>
        </label>
      </div>
      <p className="module-hint">
        Satış ekranı kısayolları: F1 nakit (para üstü), F2 kart, F3 havale, F4 veresiye, F6 bölünmüş, F7 beklet, F8 son bekleyeni geri çağır.
      </p>
    </section>
  );
}
