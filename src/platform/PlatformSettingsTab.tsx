import { useCallback, useEffect, useState } from 'react';
import {
  fetchPlatformSettingsOverview,
  savePlatformConsoleSettings,
  type PlatformConsoleSettings,
  type PlatformSettingsPayload,
} from '../services/platformApi';
import { KpiIcon } from './platformUserUi';

function SettingsSkeleton() {
  return (
    <div className="platform-settings platform-settings--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

function formatTry(n: number): string {
  return `₺${n.toLocaleString('tr-TR')}`;
}

export function PlatformSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformSettingsPayload | null>(null);
  const [draft, setDraft] = useState<PlatformConsoleSettings | null>(null);
  const [mrrDraft, setMrrDraft] = useState<Record<string, string>>({});
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformSettingsOverview();
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Veri yüklenemedi');
      setLoading(false);
      return;
    }
    setData(result.data);
    setDraft(result.data.console);
    const overrides: Record<string, string> = {};
    for (const row of result.data.planMrrCatalog) {
      if (row.overridden) {
        overrides[row.plan] = String(row.effectiveMrrTry);
      }
    }
    setMrrDraft(overrides);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveMsg(null);
    const planMrrTryOverrides: Record<string, number> = {};
    for (const [plan, raw] of Object.entries(mrrDraft)) {
      const trimmed = String(raw).trim();
      if (!trimmed) continue;
      const n = Number(trimmed);
      if (Number.isFinite(n) && n >= 0) planMrrTryOverrides[plan] = Math.round(n);
    }
    const result = await savePlatformConsoleSettings({
      maintenanceBanner: draft.maintenanceBanner,
      operatorNotes: draft.operatorNotes,
      defaultTrialDays: draft.defaultTrialDays,
      planMrrTryOverrides,
    });
    setSaving(false);
    if (!result.ok) {
      setSaveMsg(result.error ?? 'Kaydedilemedi');
      return;
    }
    setSaveMsg('Yapılandırma kaydedildi');
    void load();
  };

  if (loading && !data) return <SettingsSkeleton />;
  if (error && !data) {
    return (
      <div className="platform-settings platform-panel">
        <p className="platform-error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>
          Yeniden dene
        </button>
      </div>
    );
  }
  if (!data || !draft) return null;

  return (
    <div className="platform-settings">
      <section className="platform-users-hero">
        <div>
          <h2>Yapılandırma</h2>
          <p>
            Kiracı politikası, entegrasyonlar ve operatör ayarları — güvenlik ve destek eşikleri ilgili sekmelerden yönetilir.
          </p>
        </div>
        <button type="button" className="btn btn-text" onClick={() => void load()} disabled={loading}>
          Yenile
        </button>
      </section>

      <div className="platform-users-kpi-grid platform-settings-runtime">
        <article className="platform-users-kpi">
          <KpiIcon name="roles" />
          <span className="platform-users-kpi-label">Ortam</span>
          <strong className="platform-users-kpi-value">{data.runtime.nodeEnv}</strong>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="users" />
          <span className="platform-users-kpi-label">Allowlist</span>
          <strong className="platform-users-kpi-value">{data.runtime.allowlist.length}</strong>
          <span className="platform-users-kpi-sub">
            {data.runtime.strictTenantAllowlist ? 'Katı mod' : 'Gevşek'} · {data.runtime.allowlistSource}
          </span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <span className="platform-users-kpi-label">Herkese açık kayıt</span>
          <strong className="platform-users-kpi-value">
            {data.runtime.publicRegistrationEnabled ? 'Açık' : 'Kapalı'}
          </strong>
          <span className="platform-users-kpi-sub">{data.runtime.registrationCount} kayıt</span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="login" />
          <span className="platform-users-kpi-label">Oturum epoch</span>
          <strong className="platform-users-kpi-value">{data.runtime.platformSessionEpoch}</strong>
        </article>
      </div>

      <div className="platform-settings-columns">
        <section className="platform-panel">
          <h3>Operatör konsol ayarları</h3>
          <div className="platform-settings-form">
            <label className="platform-settings-check">
              <input
                type="checkbox"
                checked={draft.maintenanceBanner.enabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    maintenanceBanner: { ...draft.maintenanceBanner, enabled: e.target.checked },
                  })
                }
              />
              Bakım bandı (platformda göster)
            </label>
            <label>
              Bakım mesajı
              <textarea
                rows={3}
                value={draft.maintenanceBanner.message}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    maintenanceBanner: { ...draft.maintenanceBanner, message: e.target.value },
                  })
                }
                placeholder="Kısa operatör duyurusu"
              />
            </label>
            <label>
              Varsayılan deneme süresi (gün)
              <input
                type="number"
                min={1}
                max={90}
                value={draft.defaultTrialDays}
                onChange={(e) =>
                  setDraft({ ...draft, defaultTrialDays: Number(e.target.value) || 14 })
                }
              />
            </label>
            <label>
              Operatör notları
              <textarea
                rows={4}
                value={draft.operatorNotes}
                onChange={(e) => setDraft({ ...draft, operatorNotes: e.target.value })}
                placeholder="İç notlar (kiracılar görmez)"
              />
            </label>
            <button type="button" className="btn btn-primary" onClick={() => void onSave()} disabled={saving}>
              {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
            {saveMsg ? <p className="platform-inline-msg">{saveMsg}</p> : null}
          </div>
        </section>

        <section className="platform-panel">
          <h3>Politika özetleri</h3>
          <dl className="platform-settings-dl">
            <div>
              <dt>Güvenlik uyarıları</dt>
              <dd>
                {data.policies.securityAlerts.enabled ? 'Aktif' : 'Kapalı'} · e-posta ops{' '}
                {data.policies.securityAlerts.emailOps ? 'açık' : 'kapalı'} · webhook{' '}
                {data.policies.securityAlerts.webhookConfigured ? 'var' : 'yok'}
              </dd>
            </div>
            <div>
              <dt>Destek SLA</dt>
              <dd>
                İlk yanıt {data.policies.supportSla.firstResponseTargetMinutes} dk · bekleme{' '}
                {data.policies.supportSla.staleWaitingHours} sa
              </dd>
            </div>
            <div>
              <dt>Entegrasyonlar</dt>
              <dd>
                Mail track {data.integrations.mailTrackEnabled ? '✓' : '—'} · Mesaj API{' '}
                {data.integrations.messagingPublicApiConfigured ? '✓' : '—'}
              </dd>
            </div>
            <div>
              <dt>Allowlist</dt>
              <dd>{data.runtime.allowlist.join(', ')}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="platform-panel">
        <h3>Platform operatörleri</h3>
        <table className="platform-table platform-table--compact">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Görünen ad</th>
              <th>Kurtarma e-posta</th>
            </tr>
          </thead>
          <tbody>
            {data.operators.map((o) => (
              <tr key={o.username}>
                <td>{o.username}</td>
                <td>{o.displayName}</td>
                <td>{o.recoveryEmailMasked ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="platform-panel">
        <h3>Plan MRR tahmin tablosu (Gelir sekmesi)</h3>
        <p className="platform-settings-hint">Boş bırakılan planlar varsayılan değeri kullanır.</p>
        <table className="platform-table">
          <thead>
            <tr>
              <th>Plan</th>
              <th>Varsayılan</th>
              <th>Özel (₺)</th>
              <th>Etkin</th>
            </tr>
          </thead>
          <tbody>
            {data.planMrrCatalog.map((row) => (
              <tr key={row.plan}>
                <td>{row.plan}</td>
                <td>{formatTry(row.defaultMrrTry)}</td>
                <td>
                  <input
                    className="platform-settings-mrr-input"
                    type="number"
                    min={0}
                    placeholder="—"
                    value={mrrDraft[row.plan] ?? ''}
                    onChange={(e) =>
                      setMrrDraft({ ...mrrDraft, [row.plan]: e.target.value })
                    }
                  />
                </td>
                <td>{formatTry(row.effectiveMrrTry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
