import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchPlatformTenantsLifecycle,
  savePlatformTenantLifecycle,
  type PlatformTenantLifecyclePayload,
  type PlatformTenantLifecycleRow,
} from '../services/platformApi';
import { syncPosApiTokenToCurrentTenant } from '../services/posApiAuth';
import { saveTenantId } from '../storage/tenantSession';
import { KpiIcon, PlatformFilterSelect, RingProgress } from './platformUserUi';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Tüm durumlar' },
  { value: 'active', label: 'Aktif' },
  { value: 'trial', label: 'Deneme' },
  { value: 'trial_expired', label: 'Deneme bitti' },
  { value: 'suspended', label: 'Askıda' },
  { value: 'missing_store', label: 'Veri eksik' },
];

function formatTry(value: number): string {
  return `₺${value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value.trim()) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function TenantsSkeleton() {
  return (
    <div className="platform-tenants platform-tenants--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

type Draft = {
  suspended: boolean;
  readOnly: boolean;
  opsNotes: string;
  plan: string;
  trialEndsAtLocal: string;
};

function rowToDraft(row: PlatformTenantLifecycleRow): Draft {
  return {
    suspended: row.suspended,
    readOnly: row.readOnly,
    opsNotes: row.opsNotes,
    plan: row.plan ?? 'trial',
    trialEndsAtLocal: toDatetimeLocalValue(row.trialEndsAt),
  };
}

export function PlatformTenantsTab() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformTenantLifecyclePayload | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformTenantsLifecycle();
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Veri yüklenemedi');
      setLoading(false);
      return;
    }
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.tenants ?? []).filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.businessName.toLowerCase().includes(q)
        || t.tenantId.toLowerCase().includes(q)
        || (t.registrationEmail ?? '').toLowerCase().includes(q)
      );
    });
  }, [data, statusFilter, search]);

  const selected = data?.tenants.find((t) => t.tenantId === selectedId) ?? null;

  useEffect(() => {
    if (selected) setDraft(rowToDraft(selected));
    else setDraft(null);
  }, [selected]);

  const healthPct = useMemo(() => {
    if (!data?.totals.tenants) return 100;
    const healthy = data.totals.active + data.totals.trial;
    return Math.round((healthy / data.totals.tenants) * 100);
  }, [data]);

  const openTenantPos = (tenantId: string) => {
    saveTenantId(tenantId);
    syncPosApiTokenToCurrentTenant();
    navigate('/app', { replace: true });
  };

  const onSave = async () => {
    if (!selected || !draft) return;
    setSaving(true);
    setSaveMsg(null);
    const result = await savePlatformTenantLifecycle(selected.tenantId, {
      suspended: draft.suspended,
      readOnly: draft.readOnly,
      opsNotes: draft.opsNotes,
      plan: draft.plan,
      trialEndsAt: fromDatetimeLocalValue(draft.trialEndsAtLocal),
    });
    setSaving(false);
    if (!result.ok) {
      setSaveMsg(result.error ?? 'Kaydedilemedi');
      return;
    }
    setSaveMsg('Kiracı ayarları kaydedildi.');
    await load();
    if (result.tenant) {
      setSelectedId(result.tenant.tenantId);
    }
  };

  if (loading && !data) return <TenantsSkeleton />;
  if (error && !data) {
    return (
      <div className="platform-users-error">
        <p className="landing-flash landing-flash--error" role="alert">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>Tekrar dene</button>
      </div>
    );
  }
  if (!data) return null;

  const totals = data.totals;

  return (
    <div className="platform-tenants platform-tenants--premium platform-users--premium">
      <header className="platform-users-hero platform-users-hero--premium platform-tenants-hero">
        <div className="platform-users-hero-copy">
          <span className="platform-users-hero-badge">Tenant Lifecycle</span>
          <h2>Kiracılar</h2>
          <p>
            Deneme ve plan takibi, askıya alma, salt okunur mod ve operasyon notları — portföy yaşam döngüsü.
          </p>
          <time className="platform-users-hero-time" dateTime={data.generatedAt}>
            Son güncelleme: {formatDateTime(data.generatedAt)}
          </time>
        </div>
        <div className="platform-users-hero-actions">
          <div className="platform-tenants-hero-metrics">
            <RingProgress pct={healthPct} size={72} label="Sağlık" variant={healthPct >= 80 ? 'brand' : 'warn'} />
            <span className="platform-users-hero-stat-label">Sağlıklı kiracı oranı</span>
          </div>
          <ul className="platform-overview-hero-chips" aria-label="Altyapı">
            <li className={data.config.strictAllowlist ? 'is-ok' : 'is-muted'}>
              Allowlist {data.config.strictAllowlist ? 'sıkı' : 'gevşek'}
            </li>
            <li className="is-muted">{data.config.allowlist.length} kod</li>
          </ul>
          <button type="button" className="btn btn-primary platform-users-refresh" onClick={() => void load()}>
            Yenile
          </button>
        </div>
      </header>

      <div className="platform-users-kpi-grid platform-users-kpi-grid--premium" aria-label="Kiracı KPI">
        <article className="platform-users-kpi platform-users-kpi--primary">
          <KpiIcon name="users" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Toplam kiracı</span>
            <strong className="platform-users-kpi-value">{totals.tenants}</strong>
          </div>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Aktif / deneme</span>
            <strong className="platform-users-kpi-value">{totals.active + totals.trial}</strong>
            <span className="platform-users-kpi-sub">{totals.trial} deneme</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--warn">
          <KpiIcon name="sleep" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">7 gün içinde biten deneme</span>
            <strong className="platform-users-kpi-value">{totals.trialEnding7d}</strong>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--danger">
          <KpiIcon name="churn" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Askı / süresi dolmuş</span>
            <strong className="platform-users-kpi-value">{totals.suspended + totals.trial_expired}</strong>
            <span className="platform-users-kpi-sub">{totals.readOnly} salt okunur</span>
          </div>
        </article>
      </div>

      <section className="platform-comms-toolbar" aria-label="Filtreler">
        <div className="platform-users-filter-bar platform-comms-filter-bar platform-tenants-filter-bar">
          <div className="platform-users-select-grid platform-tenants-filter-grid">
            <PlatformFilterSelect
              label="Durum"
              icon="status"
              value={statusFilter}
              onChange={setStatusFilter}
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </PlatformFilterSelect>
            <label className="platform-users-select-field">
              <span className="platform-users-select-field-label">Ara</span>
              <div className="platform-users-search-wrap platform-users-search-wrap--premium">
                <span className="platform-users-search-icon" aria-hidden />
                <input
                  type="search"
                  className="platform-users-search platform-users-search--premium"
                  placeholder="Mağaza, kod veya e-posta"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </label>
          </div>
        </div>
      </section>

      <div className="platform-overview-layout">
        <section className="platform-users-panel" aria-label="Kiracı listesi">
          <div className="platform-users-panel-head">
            <h3>Portföy</h3>
            <span className="platform-muted">{filtered.length} kayıt</span>
          </div>
          <div className="platform-users-table-scroll">
            <table className="platform-table platform-table--premium">
              <thead>
                <tr>
                  <th>Mağaza</th>
                  <th>Durum</th>
                  <th>Plan</th>
                  <th>Deneme</th>
                  <th>30g ciro</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.tenantId}
                    className={selectedId === t.tenantId ? 'platform-row--active' : ''}
                  >
                    <td>
                      <strong>{t.businessName}</strong>
                      <div className="platform-muted">{t.tenantId}</div>
                      {t.registrationEmail && (
                        <div className="platform-muted">{t.registrationEmail}</div>
                      )}
                    </td>
                    <td>
                      <span className={`platform-tenant-status platform-tenant-status--${t.status}`}>
                        {t.statusLabel}
                      </span>
                      {t.readOnly && <span className="platform-tenant-flag">Salt okunur</span>}
                    </td>
                    <td>{t.plan ?? '—'}</td>
                    <td>
                      {t.trialDaysLeft != null && t.status === 'trial'
                        ? `${t.trialDaysLeft} gün`
                        : formatDateTime(t.trialEndsAt)}
                    </td>
                    <td>{formatTry(t.revenue30dTry)}</td>
                    <td className="platform-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedId(t.tenantId)}
                      >
                        Yönet
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => openTenantPos(t.tenantId)}>
                        POS
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="platform-users-panel platform-tenants-editor" aria-label="Kiracı yönetimi">
          {!selected || !draft ? (
            <div className="platform-overview-detail-empty">
              <p className="platform-overview-detail-empty-title">Yaşam döngüsü</p>
              <p className="platform-muted">Listeden bir kiracı seçin; askı, plan ve deneme bitişini buradan güncelleyin.</p>
            </div>
          ) : (
            <>
              <div className="platform-overview-detail-head">
                <h3>{selected.businessName}</h3>
                <span className="platform-comms-tenant-pill">{selected.tenantId}</span>
              </div>
              <dl className="platform-overview-stats platform-tenants-meta">
                <div><dt>Kayıt</dt><dd>{formatDateTime(selected.createdAt)}</dd></div>
                <div><dt>Posta kurulum</dt><dd>{selected.postaOnboardingStatus ?? '—'}</dd></div>
                <div><dt>Allowlist</dt><dd>{selected.onAllowlist ? 'Evet' : 'Hayır'}</dd></div>
                <div><dt>Aktif kullanıcı</dt><dd>{selected.activeUserCount}</dd></div>
              </dl>

              <div className="platform-tenants-form">
                <label className="platform-tenants-check">
                  <input
                    type="checkbox"
                    checked={draft.suspended}
                    onChange={(e) => setDraft({ ...draft, suspended: e.target.checked })}
                  />
                  Askıya al (giriş engellenir)
                </label>
                <label className="platform-tenants-check">
                  <input
                    type="checkbox"
                    checked={draft.readOnly}
                    onChange={(e) => setDraft({ ...draft, readOnly: e.target.checked })}
                  />
                  Salt okunur (POS yazma kapalı)
                </label>
                <label className="platform-tenants-field">
                  <span>Plan</span>
                  <select
                    className="platform-users-select"
                    value={draft.plan}
                    onChange={(e) => setDraft({ ...draft, plan: e.target.value })}
                  >
                    <option value="trial">trial</option>
                    <option value="pos-lite">pos-lite</option>
                    <option value="full">full</option>
                    <option value="pro">pro</option>
                  </select>
                </label>
                <label className="platform-tenants-field">
                  <span>Deneme bitiş</span>
                  <input
                    type="datetime-local"
                    className="platform-users-search platform-users-search--premium"
                    value={draft.trialEndsAtLocal}
                    onChange={(e) => setDraft({ ...draft, trialEndsAtLocal: e.target.value })}
                  />
                </label>
                <label className="platform-tenants-field">
                  <span>Operasyon notu</span>
                  <textarea
                    className="platform-tenants-notes"
                    rows={4}
                    value={draft.opsNotes}
                    onChange={(e) => setDraft({ ...draft, opsNotes: e.target.value })}
                    placeholder="İç not — müşteri görmez"
                  />
                </label>
              </div>

              {saveMsg && <p className="platform-comms-action-msg" role="status">{saveMsg}</p>}

              <div className="platform-tenants-editor-actions">
                <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void onSave()}>
                  {saving ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => openTenantPos(selected.tenantId)}>
                  POS’a geç
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
