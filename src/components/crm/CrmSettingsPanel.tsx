import type { Store } from '../../store/useStore';
import type { CrmSettings } from '../../types/crm';

interface CrmSettingsPanelProps {
  store: Store;
}

export function CrmSettingsPanel({ store }: CrmSettingsPanelProps) {
  const crm = store.crmSettings;

  const setNum = (key: keyof CrmSettings, value: string) => {
    const parsed = parseFloat(value.replace(',', '.'));
    if (Number.isNaN(parsed)) return;
    store.updateCrmSettings({ [key]: parsed });
  };

  return (
    <section className="settings-panel settings-panel--crm">
      <div className="settings-panel-head">
        <div>
          <h2>CRM & Sadakat</h2>
          <p>Puan, kredi limiti varsayılanları ve tahsilat hatırlatma</p>
        </div>
      </div>

      <div className="settings-form-grid">
        <label className="settings-field">
          <span>TL başına kazanılan puan</span>
          <input type="number" min="0" step="0.1" value={crm.pointsPerTry} onChange={(e) => setNum('pointsPerTry', e.target.value)} />
        </label>
        <label className="settings-field">
          <span>PV başına kazanılan puan</span>
          <input type="number" min="0" step="0.1" value={crm.pointsPerPv} onChange={(e) => setNum('pointsPerPv', e.target.value)} />
        </label>
        <label className="settings-field">
          <span>1 puan = TL (harcanırken)</span>
          <input type="number" min="0" step="0.01" value={crm.tryPerPointRedeem} onChange={(e) => setNum('tryPerPointRedeem', e.target.value)} />
        </label>
        <label className="settings-field">
          <span>Varsayılan veresiye vadesi (gün)</span>
          <input type="number" min="1" value={crm.defaultDueDays} onChange={(e) => setNum('defaultDueDays', e.target.value)} />
        </label>
        <label className="settings-field">
          <span>Gümüş kademe (puan)</span>
          <input type="number" min="0" value={crm.tierSilverMinPoints} onChange={(e) => setNum('tierSilverMinPoints', e.target.value)} />
        </label>
        <label className="settings-field">
          <span>Altın kademe (puan)</span>
          <input type="number" min="0" value={crm.tierGoldMinPoints} onChange={(e) => setNum('tierGoldMinPoints', e.target.value)} />
        </label>
        <label className="settings-field">
          <span>Platin kademe (puan)</span>
          <input type="number" min="0" value={crm.tierPlatinumMinPoints} onChange={(e) => setNum('tierPlatinumMinPoints', e.target.value)} />
        </label>
        <label className="settings-field">
          <span>Doğum günü bonus puan</span>
          <input type="number" min="0" value={crm.birthdayBonusPoints} onChange={(e) => setNum('birthdayBonusPoints', e.target.value)} />
        </label>
      </div>
    </section>
  );
}
