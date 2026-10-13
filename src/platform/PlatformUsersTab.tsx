import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  fetchPlatformUserOperations,
  type PlatformRecentLoginRow,
  type PlatformUserRosterRow,
  type PlatformUserTotals,
} from '../services/platformApi';
import { avatarHue, KpiIcon, PlatformFilterSelect, RingProgress, userInitials } from './platformUserUi';

const ENGAGEMENT_LABELS: Record<string, string> = {
  active: 'Aktif',
  new: 'Yeni (30g)',
  dormant_30: '30g giriş yok',
  dormant_60: '60g+ giriş yok',
  never_logged_in: 'Hiç giriş yok',
  churned: 'Pasif / terk',
};

const ENGAGEMENT_ORDER = ['active', 'new', 'dormant_30', 'dormant_60', 'never_logged_in', 'churned'] as const;

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

function relativeLogin(iso: string | null): string {
  if (!iso) return 'Giriş kaydı yok';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Bugün';
  if (days === 1) return 'Dün';
  if (days < 30) return `${days} gün önce`;
  return formatDateTime(iso);
}

function UsersTabSkeleton() {
  return (
    <div className="platform-users platform-users--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
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
  const [loginFilter, setLoginFilter] = useState<'all' | 'success' | 'fail'>('all');

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

  const filteredLogins = useMemo(() => {
    if (loginFilter === 'all') return recentLogins;
    return recentLogins.filter((e) => (loginFilter === 'success' ? e.success : !e.success));
  }, [recentLogins, loginFilter]);

  const rosterFiltersActive = search.trim() !== ''
    || tenantFilter !== 'all'
    || engagementFilter !== 'all'
    || roleFilter !== 'all';

  const resetRosterFilters = useCallback(() => {
    setSearch('');
    setTenantFilter('all');
    setEngagementFilter('all');
    setRoleFilter('all');
  }, []);

  const loginSuccessRate = useMemo(() => {
    if (!totals) return 0;
    const total = totals.loginSuccess30d + totals.loginFailed30d;
    if (!total) return 100;
    return Math.round((totals.loginSuccess30d / total) * 100);
  }, [totals]);

  const engagementSegments = useMemo(() => {
    if (!totals?.totalUsers) return [];
    return ENGAGEMENT_ORDER
      .filter((key) => (engagementBreakdown[key] ?? 0) > 0)
      .map((key) => ({
        key,
        count: engagementBreakdown[key] ?? 0,
        pct: Math.round(((engagementBreakdown[key] ?? 0) / totals.totalUsers) * 100),
      }));
  }, [engagementBreakdown, totals]);

  if (loading) return <UsersTabSkeleton />;
  if (error) {
    return (
      <div className="platform-users-error">
        <p className="landing-flash landing-flash--error" role="alert">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>Tekrar dene</button>
      </div>
    );
  }
  if (!totals) return null;

  return (
    <div className="platform-users platform-users--premium">
      <header className="platform-users-hero platform-users-hero--premium">
        <div className="platform-users-hero-copy">
          <span className="platform-users-hero-badge">Platform Intelligence</span>
          <h2>Kullanıcı işlemleri</h2>
          <p>
            Kayıtlı hesaplar, aktivite, güvenlik ve terk sinyalleri — tüm kiracılar tek ekranda.
          </p>
          {generatedAt && (
            <time className="platform-users-hero-time" dateTime={generatedAt}>
              Son güncelleme: {formatDateTime(generatedAt)}
            </time>
          )}
        </div>
        <div className="platform-users-hero-actions">
          <div className="platform-users-hero-stat">
            <RingProgress pct={totals.engagementRate30d} label="30g giriş oranı" />
            <span className="platform-users-hero-stat-label">30g giriş oranı</span>
          </div>
          <button type="button" className="btn btn-primary platform-users-refresh" onClick={() => void load()}>
            Yenile
          </button>
        </div>
      </header>

      <div className="platform-users-kpi-grid platform-users-kpi-grid--premium">
        <article className="platform-users-kpi platform-users-kpi--primary">
          <KpiIcon name="users" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Toplam kullanıcı</span>
            <strong className="platform-users-kpi-value">{totals.totalUsers}</strong>
            <span className="platform-users-kpi-trend platform-users-kpi-trend--up">+{totals.newUsers30d} / 30g</span>
          </div>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Aktif hesap</span>
            <strong className="platform-users-kpi-value">{totals.activeCount}</strong>
            <span className="platform-users-kpi-sub">{totals.loggedInLast7d} son 7 gün giriş</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--danger">
          <KpiIcon name="churn" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Pasif / terk</span>
            <strong className="platform-users-kpi-value">{totals.churnedCount}</strong>
            <span className="platform-users-kpi-sub">kapatılmış hesap</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--warn">
          <KpiIcon name="sleep" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Uyuyan (30g)</span>
            <strong className="platform-users-kpi-value">{totals.dormant30dCount}</strong>
            <span className="platform-users-kpi-sub">{totals.dormant60dCount} adet 60g+</span>
          </div>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="roles" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Yönetici / kasiyer</span>
            <strong className="platform-users-kpi-value">{totals.adminCount}<span className="platform-users-kpi-sep">/</span>{totals.cashierCount}</strong>
            <div className="platform-users-role-bar" aria-hidden>
              <span style={{ width: `${totals.totalUsers ? (totals.adminCount / totals.totalUsers) * 100 : 0}%` }} />
            </div>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--ring">
          <RingProgress pct={totals.totpCoveragePct} variant={totals.totpCoveragePct >= 50 ? 'brand' : 'warn'} />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">2FA kapsamı</span>
            <strong className="platform-users-kpi-value">{formatPct(totals.totpCoveragePct)}</strong>
            <span className="platform-users-kpi-sub">{totals.totpEnabledCount} hesap</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--ring">
          <RingProgress
            pct={totals.recoveryEmailCoveragePct}
            variant={totals.recoveryEmailCoveragePct >= 80 ? 'brand' : 'warn'}
          />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Sıfırlama e-postası</span>
            <strong className="platform-users-kpi-value">{formatPct(totals.recoveryEmailCoveragePct)}</strong>
            <span className="platform-users-kpi-sub platform-users-kpi-sub--warn">{totals.missingRecoveryEmailCount} eksik</span>
          </div>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="login" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Giriş (30g)</span>
            <strong className="platform-users-kpi-value">{totals.loginSuccess30d}</strong>
            <div className="platform-users-login-rate">
              <div className="platform-users-login-rate-bar">
                <span style={{ width: `${loginSuccessRate}%` }} />
              </div>
              <span className="platform-users-kpi-sub">{loginSuccessRate}% başarı · {totals.loginFailed30d} hata</span>
            </div>
          </div>
        </article>
      </div>

      <section className="platform-users-panel platform-users-engagement" aria-label="Etkileşim dağılımı">
        <div className="platform-users-panel-head">
          <h3>Etkileşim durumu</h3>
          <span className="platform-muted">{totals.totalUsers} kullanıcı</span>
        </div>
        <div className="platform-users-stacked-bar" role="img" aria-label="Etkileşim dağılımı">
          {engagementSegments.map((seg) => (
            <span
              key={seg.key}
              className={`platform-users-stacked-segment platform-users-stacked-segment--${seg.key}`}
              style={{ width: `${seg.pct}%` }}
              title={`${ENGAGEMENT_LABELS[seg.key]}: ${seg.count}`}
            />
          ))}
        </div>
        <ul className="platform-users-engagement-legend">
          {ENGAGEMENT_ORDER.map((key) => {
            const count = engagementBreakdown[key] ?? 0;
            const pct = totals.totalUsers ? Math.round((count / totals.totalUsers) * 100) : 0;
            return (
              <li key={key} className={count === 0 ? 'platform-users-legend-item--empty' : ''}>
                <span className={`platform-users-legend-dot platform-users-legend-dot--${key}`} />
                <span>{ENGAGEMENT_LABELS[key]}</span>
                <strong>{count}</strong>
                <span className="platform-muted">{pct}%</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="platform-users-panel" aria-label="Kiracı bazlı özet">
        <div className="platform-users-panel-head">
          <h3>Mağaza bazlı kullanıcı özeti</h3>
        </div>
        <div className="platform-users-table-scroll">
          <table className="platform-table platform-users-tenant-table platform-table--premium">
            <thead>
              <tr>
                <th>Mağaza</th>
                <th>Toplam</th>
                <th>Aktif</th>
                <th>Terk</th>
                <th>Uyuyan</th>
                <th>30g giriş</th>
                <th>2FA</th>
                <th>E-posta</th>
              </tr>
            </thead>
            <tbody>
              {tenantStats.map((t) => {
                const loginPct = t.activeCount
                  ? Math.round((t.loggedInLast30d / t.activeCount) * 100)
                  : 0;
                return (
                  <tr key={t.tenantId}>
                    <td>
                      <div className="platform-users-store-cell">
                        <span className="platform-users-store-avatar">{t.businessName.slice(0, 1)}</span>
                        <div>
                          <strong>{t.businessName}</strong>
                          <div className="platform-muted">{t.tenantId}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="platform-users-num">{t.totalUsers}</span></td>
                    <td><span className="platform-users-num platform-users-num--ok">{t.activeCount}</span></td>
                    <td>
                      <span className={t.churnedCount > 0 ? 'platform-users-num platform-users-num--bad' : 'platform-users-num'}>
                        {t.churnedCount}
                      </span>
                    </td>
                    <td>
                      <span className={t.dormant30dCount > 0 ? 'platform-users-num platform-users-num--warn' : 'platform-users-num'}>
                        {t.dormant30dCount}
                      </span>
                    </td>
                    <td>
                      <div className="platform-users-inline-metric">
                        <div className="platform-users-mini-bar"><span style={{ width: `${loginPct}%` }} /></div>
                        <span>{t.activeCount ? formatPct(loginPct) : '—'}</span>
                      </div>
                    </td>
                    <td><span className="platform-users-pct">{formatPct(t.totpCoveragePct)}</span></td>
                    <td>
                      <span className={t.recoveryEmailCoveragePct < 100 ? 'platform-users-pct platform-users-pct--warn' : 'platform-users-pct'}>
                        {formatPct(t.recoveryEmailCoveragePct)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="platform-users-panel platform-users-panel--directory" aria-label="Kullanıcı listesi">
        <div className="platform-users-panel-head platform-users-panel-head--stack">
          <div>
            <h3>Kullanıcı dizini</h3>
            <p className="platform-muted">{filteredRoster.length} / {roster.length} kayıt</p>
          </div>
          <div className="platform-users-filter-bar" role="search">
            <label className="platform-users-search-wrap platform-users-search-wrap--premium">
              <span className="platform-users-search-icon" aria-hidden />
              <input
                type="search"
                placeholder="Ad, kullanıcı adı, mağaza…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="platform-users-search platform-users-search--premium"
              />
              {search.trim() !== '' && (
                <button
                  type="button"
                  className="platform-users-search-clear"
                  onClick={() => setSearch('')}
                  aria-label="Aramayı temizle"
                />
              )}
            </label>
            <div className="platform-users-select-grid">
              <PlatformFilterSelect
                label="Mağaza"
                icon="store"
                value={tenantFilter}
                onChange={setTenantFilter}
              >
                <option value="all">Tüm mağazalar</option>
                {tenantStats.map((t) => (
                  <option key={t.tenantId} value={t.tenantId}>{t.businessName}</option>
                ))}
              </PlatformFilterSelect>
              <PlatformFilterSelect
                label="Durum"
                icon="status"
                value={engagementFilter}
                onChange={(v) => setEngagementFilter(v as FilterEngagement)}
              >
                <option value="all">Tüm durumlar</option>
                {Object.entries(ENGAGEMENT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </PlatformFilterSelect>
              <PlatformFilterSelect
                label="Rol"
                icon="role"
                value={roleFilter}
                onChange={(v) => setRoleFilter(v as 'all' | 'admin' | 'cashier')}
              >
                <option value="all">Tüm roller</option>
                <option value="admin">Yönetici</option>
                <option value="cashier">Kasiyer</option>
              </PlatformFilterSelect>
            </div>
            {rosterFiltersActive && (
              <button type="button" className="platform-users-filter-reset" onClick={resetRosterFilters}>
                Filtreleri sıfırla
              </button>
            )}
          </div>
        </div>
        <div className="platform-users-chip-row platform-users-chip-row--premium">
          {ENGAGEMENT_ORDER.map((key) => {
            const count = engagementBreakdown[key] ?? 0;
            if (!count) return null;
            return (
              <button
                key={key}
                type="button"
                className={`platform-users-chip platform-users-chip--seg platform-users-chip--seg-${key} ${engagementFilter === key ? 'platform-users-chip--on' : ''}`}
                onClick={() => setEngagementFilter(engagementFilter === key ? 'all' : key)}
              >
                <span className="platform-users-chip-dot" aria-hidden />
                {ENGAGEMENT_LABELS[key]}
                <span className="platform-users-chip-count">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="platform-users-roster-wrap">
          <table className="platform-table platform-users-roster platform-table--premium">
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
              {filteredRoster.length === 0 && (
                <tr>
                  <td colSpan={6} className="platform-users-empty">
                    Filtrelere uyan kullanıcı bulunamadı. Aramayı veya filtreleri değiştirin.
                  </td>
                </tr>
              )}
              {filteredRoster.map((row) => (
                <tr key={`${row.tenantId}-${row.id}`} className={!row.isActive ? 'platform-users-row--inactive' : ''}>
                  <td>
                    <div className="platform-users-person">
                      <span
                        className="platform-users-avatar"
                        style={{ '--avatar-hue': avatarHue(row.username) } as CSSProperties}
                      >
                        {userInitials(row.displayName, row.username)}
                      </span>
                      <div>
                        <strong>{row.displayName}</strong>
                        <div className="platform-muted">@{row.username}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="platform-users-store-tag">{row.businessName}</span></td>
                  <td>
                    <span className={`platform-users-role platform-users-role--${row.role}`}>
                      {row.role === 'admin' ? 'Yönetici' : 'Kasiyer'}
                    </span>
                  </td>
                  <td>
                    <span className={`platform-users-pill platform-users-pill--${row.engagement}`}>
                      {ENGAGEMENT_LABELS[row.engagement] ?? row.engagement}
                    </span>
                  </td>
                  <td>
                    <span className="platform-users-last-login">{formatDateTime(row.lastLoginAt)}</span>
                    <span className="platform-muted platform-users-last-login-sub">{relativeLogin(row.lastLoginAt)}</span>
                  </td>
                  <td>
                    <div className="platform-users-security-chips">
                      {row.totpEnabled && <span className="platform-users-chip-sec platform-users-chip-sec--ok">2FA</span>}
                      {row.hasRecoveryEmail
                        ? <span className="platform-users-chip-sec platform-users-chip-sec--ok">E-posta</span>
                        : row.isActive && <span className="platform-users-chip-sec platform-users-chip-sec--bad">E-posta</span>}
                      {row.mustChangePassword && <span className="platform-users-chip-sec">Şifre</span>}
                      {!row.totpEnabled && row.hasRecoveryEmail && !row.mustChangePassword && (
                        <span className="platform-muted">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="platform-users-panel" aria-label="Son girişler">
        <div className="platform-users-panel-head">
          <h3>Son giriş denemeleri</h3>
          <div className="platform-users-login-filters">
            <button
              type="button"
              className={`platform-users-chip ${loginFilter === 'all' ? 'platform-users-chip--on' : ''}`}
              onClick={() => setLoginFilter('all')}
            >
              Tümü
            </button>
            <button
              type="button"
              className={`platform-users-chip ${loginFilter === 'success' ? 'platform-users-chip--on' : ''}`}
              onClick={() => setLoginFilter('success')}
            >
              Başarılı
            </button>
            <button
              type="button"
              className={`platform-users-chip ${loginFilter === 'fail' ? 'platform-users-chip--on' : ''}`}
              onClick={() => setLoginFilter('fail')}
            >
              Başarısız
            </button>
          </div>
        </div>
        <ul className="platform-users-timeline">
          {filteredLogins.length === 0 && (
            <li className="platform-users-timeline-empty">Bu filtre için giriş kaydı yok.</li>
          )}
          {filteredLogins.map((entry) => (
            <li
              key={`${entry.tenantId}-${entry.id}`}
              className={`platform-users-timeline-item ${entry.success ? 'is-success' : 'is-fail'}`}
            >
              <span className="platform-users-timeline-dot" aria-hidden />
              <div className="platform-users-timeline-body">
                <div className="platform-users-timeline-top">
                  <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                  <span className={`platform-users-timeline-badge ${entry.success ? 'is-ok' : 'is-bad'}`}>
                    {entry.success ? 'Başarılı' : 'Başarısız'}
                  </span>
                </div>
                <p className="platform-users-timeline-who">
                  {entry.displayName ?? entry.username}
                  <span className="platform-muted"> · {entry.businessName}</span>
                </p>
                {!entry.success && entry.failureReason && (
                  <p className="platform-users-timeline-detail">{entry.failureReason}</p>
                )}
                {entry.method && <p className="platform-muted platform-users-timeline-meta">{entry.method}{entry.clientIp ? ` · ${entry.clientIp}` : ''}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
