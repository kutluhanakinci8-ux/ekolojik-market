import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPlatformUserOperations,
  type PlatformRecentLoginRow,
  type PlatformUserRosterRow,
  type PlatformUserTotals,
} from '../services/platformApi';

const ENGAGEMENT_LABELS: Record<string, string> = {
  active: 'Aktif',
  new: 'Yeni (30g)',
  dormant_30: '30g giriş yok',
  dormant_60: '60g+ giriş yok',
  never_logged_in: 'Hiç giriş yok',
  churned: 'Pasif / terk',
};

type FilterEngagement = 'all' | PlatformUserRosterRow['engagement'];

function formatPct(n: number): string {
  return `${n}%`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export function PlatformUsersTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<PlatformUserTotals | null>(null);
  const [engagementBreakdown, setEngagementBreakdown] = useState<Record<string, number>>({});
  const [tenantStats, setTenantStats] = useState<
    Array<{ tenantId: string; businessName: string } & PlatformUserTotals>
  >([]);
  const [roster, setRoster] = useState<PlatformUserRosterRow[]>([]);
  const [recentLogins, setRecentLogins] = useState<PlatformRecentLoginRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [tenantFilter, setTenantFilter] = useState('all');
  const [engagementFilter, setEngagementFilter] = useState<FilterEngagement>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'cashier'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformUserOperations();
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Veri yüklenemedi');
      setLoading(false);
      return;
    }
    const d = result.data;
    setTotals(d.totals);
    setEngagementBreakdown(d.engagementBreakdown);
    setTenantStats(d.tenants);
    setRoster(d.roster);
    setRecentLogins(d.recentLogins);
    setGeneratedAt(d.generatedAt);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();
    return roster.filter((row) => {
      if (tenantFilter !== 'all' && row.tenantId !== tenantFilter) return false;
      if (engagementFilter !== 'all' && row.engagement !== engagementFilter) return false;
      if (roleFilter !== 'all' && row.role !== roleFilter) return false;
      if (!q) return true;
      return (
        row.username.includes(q)
        || row.displayName.toLowerCase().includes(q)
        || row.businessName.toLowerCase().includes(q)
      );
    });
  }, [roster, search, tenantFilter, engagementFilter, roleFilter]);

  if (loading) {
    return <p className="platform-muted">Kullanıcı işlemleri yükleniyor…</p>;
  }
  if (error) {
    return (
      <p className="landing-flash landing-flash--error" role="alert">
        {error}
        <button type="button" className="btn btn-text" onClick={() => void load()}>Tekrar dene</button>
      </p>
    );
  }
  if (!totals) return null;

  return (
    <div className="platform-users">
      <div className="platform-users-hero">
        <div>
          <h2>Kullanıcı işlemleri</h2>
          <p className="platform-muted">
            Tüm kiracılar — kayıtlı hesaplar, aktivite, güvenlik ve terk sinyalleri
            {generatedAt ? ` · ${formatDateTime(generatedAt)}` : ''}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Yenile
        </button>
      </div>

      <div className="platform-users-kpi-grid">
        <article className="platform-users-kpi platform-users-kpi--primary">
          <span className="platform-users-kpi-label">Toplam kullanıcı</span>
          <strong className="platform-users-kpi-value">{totals.totalUsers}</strong>
          <span className="platform-users-kpi-sub">+{totals.newUsers30d} son 30 gün</span>
        </article>
        <article className="platform-users-kpi">
          <span className="platform-users-kpi-label">Aktif</span>
          <strong className="platform-users-kpi-value">{totals.activeCount}</strong>
          <span className="platform-users-kpi-sub">{formatPct(totals.engagementRate30d)} 30g giriş</span>
        </article>
        <article className="platform-users-kpi platform-users-kpi--warn">
          <span className="platform-users-kpi-label">Pasif / terk</span>
          <strong className="platform-users-kpi-value">{totals.churnedCount}</strong>
          <span className="platform-users-kpi-sub">hesap kapatılmış</span>
        </article>
        <article className="platform-users-kpi platform-users-kpi--warn">
          <span className="platform-users-kpi-label">Uyuyan (30g)</span>
          <strong className="platform-users-kpi-value">{totals.dormant30dCount}</strong>
          <span className="platform-users-kpi-sub">{totals.dormant60dCount} adet 60g+</span>
        </article>
        <article className="platform-users-kpi">
          <span className="platform-users-kpi-label">Yönetici / kasiyer</span>
          <strong className="platform-users-kpi-value">{totals.adminCount} / {totals.cashierCount}</strong>
          <span className="platform-users-kpi-sub">rol dağılımı</span>
        </article>
        <article className="platform-users-kpi">
          <span className="platform-users-kpi-label">2FA kapsamı</span>
          <strong className="platform-users-kpi-value">{formatPct(totals.totpCoveragePct)}</strong>
          <span className="platform-users-kpi-sub">{totals.totpEnabledCount} hesap</span>
        </article>
        <article className="platform-users-kpi">
          <span className="platform-users-kpi-label">Sıfırlama e-postası</span>
          <strong className="platform-users-kpi-value">{formatPct(totals.recoveryEmailCoveragePct)}</strong>
          <span className="platform-users-kpi-sub">{totals.missingRecoveryEmailCount} eksik</span>
        </article>
        <article className="platform-users-kpi">
          <span className="platform-users-kpi-label">Giriş (30g)</span>
          <strong className="platform-users-kpi-value">{totals.loginSuccess30d}</strong>
          <span className="platform-users-kpi-sub">{totals.loginFailed30d} başarısız</span>
        </article>
      </div>

      <section className="platform-users-engagement" aria-label="Etkileşim dağılımı">
        <h3>Etkileşim durumu</h3>
        <div className="platform-users-engagement-bars">
          {Object.entries(engagementBreakdown).map(([key, count]) => {
            const pct = totals.totalUsers ? Math.round((count / totals.totalUsers) * 100) : 0;
            return (
              <div key={key} className="platform-users-engagement-row">
                <span className="platform-users-engagement-label">{ENGAGEMENT_LABELS[key] ?? key}</span>
                <div className="platform-users-engagement-track">
                  <div className="platform-users-engagement-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="platform-users-engagement-count">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="platform-users-section" aria-label="Kiracı bazlı özet">
        <h3>Mağaza bazlı kullanıcı özeti</h3>
        <table className="platform-table platform-users-tenant-table">
          <thead>
            <tr>
              <th>Mağaza</th>
              <th>Toplam</th>
              <th>Aktif</th>
              <th>Terk</th>
              <th>Uyuyan</th>
              <th>30g giriş %</th>
              <th>2FA</th>
              <th>E-posta</th>
            </tr>
          </thead>
          <tbody>
            {tenantStats.map((t) => (
              <tr key={t.tenantId}>
                <td>
                  <strong>{t.businessName}</strong>
                  <div className="platform-muted">{t.tenantId}</div>
                </td>
                <td>{t.totalUsers}</td>
                <td>{t.activeCount}</td>
                <td className={t.churnedCount > 0 ? 'platform-warn' : ''}>{t.churnedCount}</td>
                <td className={t.dormant30dCount > 0 ? 'platform-warn' : ''}>{t.dormant30dCount}</td>
                <td>
                  {t.activeCount
                    ? formatPct(Math.round((t.loggedInLast30d / t.activeCount) * 100))
                    : '—'}
                </td>
                <td>{formatPct(t.totpCoveragePct)}</td>
                <td>{formatPct(t.recoveryEmailCoveragePct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="platform-users-section" aria-label="Kullanıcı listesi">
        <div className="platform-users-toolbar">
          <h3>Kullanıcı dizini</h3>
          <div className="platform-users-filters">
            <input
              type="search"
              placeholder="Ad, kullanıcı adı, mağaza…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="platform-users-search"
            />
            <select value={tenantFilter} onChange={(e) => setTenantFilter(e.target.value)}>
              <option value="all">Tüm mağazalar</option>
              {tenantStats.map((t) => (
                <option key={t.tenantId} value={t.tenantId}>{t.businessName}</option>
              ))}
            </select>
            <select
              value={engagementFilter}
              onChange={(e) => setEngagementFilter(e.target.value as FilterEngagement)}
            >
              <option value="all">Tüm durumlar</option>
              {Object.entries(ENGAGEMENT_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </select>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | 'admin' | 'cashier')}>
              <option value="all">Tüm roller</option>
              <option value="admin">Yönetici</option>
              <option value="cashier">Kasiyer</option>
            </select>
          </div>
        </div>
        <p className="platform-muted">{filteredRoster.length} kayıt gösteriliyor</p>
        <div className="platform-users-roster-wrap">
          <table className="platform-table platform-users-roster">
            <thead>
              <tr>
                <th>Kullanıcı</th>
                <th>Mağaza</th>
                <th>Rol</th>
                <th>Durum</th>
                <th>Son giriş</th>
                <th>Güvenlik</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoster.map((row) => (
                <tr key={`${row.tenantId}-${row.id}`} className={!row.isActive ? 'platform-users-row--inactive' : ''}>
                  <td>
                    <strong>{row.displayName}</strong>
                    <div className="platform-muted">@{row.username}</div>
                  </td>
                  <td>{row.businessName}</td>
                  <td>{row.role === 'admin' ? 'Yönetici' : 'Kasiyer'}</td>
                  <td>
                    <span className={`platform-users-pill platform-users-pill--${row.engagement}`}>
                      {ENGAGEMENT_LABELS[row.engagement] ?? row.engagement}
                    </span>
                  </td>
                  <td>{formatDateTime(row.lastLoginAt)}</td>
                  <td className="platform-users-security">
                    {row.totpEnabled ? <span title="2FA">2FA</span> : null}
                    {!row.hasRecoveryEmail && row.isActive ? <span className="platform-warn">E-posta</span> : null}
                    {row.mustChangePassword ? <span>Şifre</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="platform-users-section" aria-label="Son girişler">
        <h3>Son giriş denemeleri</h3>
        <ul className="platform-users-login-feed">
          {recentLogins.map((entry) => (
            <li
              key={`${entry.tenantId}-${entry.id}`}
              className={entry.success ? 'platform-users-login--ok' : 'platform-users-login--fail'}
            >
              <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
              <span className="platform-users-login-who">
                {entry.displayName ?? entry.username} · {entry.businessName}
              </span>
              <span className="platform-muted">
                {entry.success ? 'Başarılı' : 'Başarısız'}
                {entry.method ? ` · ${entry.method}` : ''}
                {entry.failureReason ? ` — ${entry.failureReason}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
