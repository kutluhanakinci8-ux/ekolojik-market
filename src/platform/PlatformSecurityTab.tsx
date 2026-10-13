import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchPlatformSecurityOverview,
  type PlatformSecurityPayload,
  type PlatformSecurityRecommendation,
} from '../services/platformApi';
import type { PlatformUsersTabFocus } from './PlatformUsersTab';
import { KpiIcon, RingProgress } from './platformUserUi';

const PRIORITY_LABELS: Record<string, string> = {
  high: 'Yüksek',
  medium: 'Orta',
  low: 'Düşük',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function formatDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

type Props = {
  onNavigateUsers?: (focus: PlatformUsersTabFocus) => void;
};

function SecuritySkeleton() {
  return (
    <div className="platform-security platform-security--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

export function PlatformSecurityTab({ onNavigateUsers }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformSecurityPayload | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformSecurityOverview();
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

  const trendMax = useMemo(() => {
    if (!data?.loginTrend.length) return 1;
    return Math.max(
      1,
      ...data.loginTrend.map((d) => d.success + d.failed),
    );
  }, [data]);

  const failedRecent = useMemo(
    () => (data?.recentLogins ?? []).filter((e) => !e.success).slice(0, 12),
    [data],
  );

  if (loading) return <SecuritySkeleton />;
  if (error) {
    return (
      <div className="platform-users-error">
        <p className="landing-flash landing-flash--error" role="alert">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>Tekrar dene</button>
      </div>
    );
  }
  if (!data) return null;

  const { totals, dimensions } = data;

  return (
    <div className="platform-security platform-security--premium platform-users--premium">
      <header className="platform-users-hero platform-users-hero--premium platform-security-hero">
        <div className="platform-users-hero-copy">
          <span className="platform-users-hero-badge">Security Center</span>
          <h2>Güvenlik</h2>
          <p>
            Kimlik, giriş tehditleri, MFA ve kurtarma e-postası kapsamı — tüm kiracılar için platform güvenlik nabzı.
          </p>
          <time className="platform-users-hero-time" dateTime={data.generatedAt}>
            Son güncelleme: {formatDateTime(data.generatedAt)}
          </time>
        </div>
        <div className="platform-users-hero-actions">
          <div className="platform-security-grade-wrap">
            <RingProgress
              pct={data.score}
              size={72}
              label="Güvenlik skoru"
              variant={data.score >= 70 ? 'brand' : 'warn'}
            />
            <span className="platform-users-hero-stat-label">
              Güvenlik skoru · Not {data.grade}
            </span>
          </div>
          <button type="button" className="btn btn-primary platform-users-refresh" onClick={() => void load()}>
            Yenile
          </button>
        </div>
      </header>

      <div className="platform-users-kpi-grid platform-users-kpi-grid--premium">
        <article className="platform-users-kpi platform-users-kpi--danger">
          <KpiIcon name="churn" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Açık öneri (yüksek)</span>
            <strong className="platform-users-kpi-value">{data.recommendationSummary.high}</strong>
            <span className="platform-users-kpi-sub">{data.recommendationSummary.total} toplam öneri</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--ring">
          <RingProgress pct={dimensions.adminMfaPct} variant={dimensions.adminMfaPct >= 80 ? 'brand' : 'warn'} />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Yönetici 2FA</span>
            <strong className="platform-users-kpi-value">{dimensions.adminMfaPct}%</strong>
            <span className="platform-users-kpi-sub">aktif yöneticiler</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--ring">
          <RingProgress
            pct={dimensions.recoveryEmailPct}
            variant={dimensions.recoveryEmailPct >= 90 ? 'brand' : 'warn'}
          />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Kurtarma e-postası</span>
            <strong className="platform-users-kpi-value">{dimensions.recoveryEmailPct}%</strong>
            <span className="platform-users-kpi-sub">{totals.missingRecoveryEmailCount} eksik</span>
          </div>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="login" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Giriş başarısı (30g)</span>
            <strong className="platform-users-kpi-value">{dimensions.loginSuccessPct}%</strong>
            <span className="platform-users-kpi-sub">{totals.loginFailed30d} başarısız deneme</span>
          </div>
        </article>
      </div>

      <section className="platform-users-panel" aria-label="Güvenlik önerileri">
        <div className="platform-users-panel-head">
          <h3>Öneriler &amp; iyileştirmeler</h3>
          <span className="platform-muted">Entra / Auth0 tarzı önceliklendirilmiş aksiyon listesi</span>
        </div>
        {data.recommendations.length === 0 ? (
          <p className="platform-muted platform-security-empty-hint">Kritik öneri yok — mevcut politikalar iyi görünüyor.</p>
        ) : (
          <ul className="platform-security-rec-list">
            {data.recommendations.map((rec) => (
              <RecommendationRow
                key={rec.id}
                rec={rec}
                onNavigateUsers={onNavigateUsers}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="platform-users-panel" aria-label="Giriş trendi">
        <div className="platform-users-panel-head">
          <h3>Giriş aktivitesi (14 gün)</h3>
          <span className="platform-muted">Başarılı vs başarısız</span>
        </div>
        <div className="platform-security-trend" role="img" aria-label="14 günlük giriş trendi">
          {data.loginTrend.map((day) => {
            const total = day.success + day.failed;
            const h = total ? Math.max(4, Math.round((total / trendMax) * 100)) : 2;
            const failH = total ? Math.round((day.failed / total) * h) : 0;
            const okH = h - failH;
            return (
              <div key={day.dateKey} className="platform-security-trend-col" title={`${day.dateKey}: ${day.success} ok, ${day.failed} fail`}>
                <div className="platform-security-trend-bar" style={{ height: `${h}%` }}>
                  {okH > 0 && <span className="platform-security-trend-ok" style={{ flex: okH }} />}
                  {failH > 0 && <span className="platform-security-trend-fail" style={{ flex: failH }} />}
                </div>
                <span className="platform-security-trend-label">{formatDayLabel(day.dateKey)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="platform-users-panel" aria-label="Mağaza güvenlik skoru">
        <div className="platform-users-panel-head">
          <h3>Mağaza bazlı güvenlik</h3>
        </div>
        <div className="platform-users-table-scroll">
          <table className="platform-table platform-table--premium">
            <thead>
              <tr>
                <th>Mağaza</th>
                <th>Skor</th>
                <th>E-posta</th>
                <th>2FA</th>
                <th>30g hata</th>
              </tr>
            </thead>
            <tbody>
              {data.tenantSnapshots.map((t) => (
                <tr key={t.tenantId}>
                  <td>
                    <strong>{t.businessName}</strong>
                    <div className="platform-muted">{t.tenantId}</div>
                  </td>
                  <td>
                    <span className={`platform-security-mini-score ${t.securityScore < 60 ? 'is-warn' : ''}`}>
                      {t.securityScore}
                    </span>
                  </td>
                  <td>{t.recoveryEmailCoveragePct}%</td>
                  <td>{t.totpCoveragePct}%</td>
                  <td>
                    <span className={t.loginFailed30d > 5 ? 'platform-users-num platform-users-num--bad' : 'platform-users-num'}>
                      {t.loginFailed30d}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.failedByIp.length > 0 && (
        <section className="platform-users-panel" aria-label="Başarısız giriş IP">
          <div className="platform-users-panel-head">
            <h3>Şüpheli IP özetleri (7g)</h3>
          </div>
          <div className="platform-users-table-scroll">
            <table className="platform-table platform-table--premium">
              <thead>
                <tr>
                  <th>IP</th>
                  <th>Başarısız</th>
                  <th>Kullanıcı</th>
                  <th>Mağaza</th>
                  <th>Son</th>
                </tr>
              </thead>
              <tbody>
                {data.failedByIp.map((row) => (
                  <tr key={row.clientIp}>
                    <td><code className="platform-security-ip">{row.clientIp}</code></td>
                    <td><strong>{row.failedCount}</strong></td>
                    <td>{row.distinctUsernames}</td>
                    <td className="platform-muted">{row.sampleTenants || '—'}</td>
                    <td>{formatDateTime(row.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="platform-users-panel" aria-label="Son başarısız girişler">
        <div className="platform-users-panel-head">
          <h3>Son başarısız giriş denemeleri</h3>
        </div>
        <ul className="platform-users-timeline">
          {failedRecent.length === 0 && (
            <li className="platform-users-timeline-empty">Son kayıtlarda başarısız giriş yok.</li>
          )}
          {failedRecent.map((entry) => (
            <li key={`${entry.tenantId}-${entry.id}`} className="platform-users-timeline-item is-fail">
              <span className="platform-users-timeline-dot" aria-hidden />
              <div className="platform-users-timeline-body">
                <div className="platform-users-timeline-top">
                  <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
                  <span className="platform-users-timeline-badge is-bad">Başarısız</span>
                </div>
                <p className="platform-users-timeline-who">
                  {entry.displayName ?? entry.username}
                  <span className="platform-muted"> · {entry.businessName}</span>
                </p>
                {entry.failureReason && (
                  <p className="platform-users-timeline-detail">{entry.failureReason}</p>
                )}
                <p className="platform-muted platform-users-timeline-meta">
                  {entry.method ?? 'password'}{entry.clientIp ? ` · ${entry.clientIp}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RecommendationRow({
  rec,
  onNavigateUsers,
}: {
  rec: PlatformSecurityRecommendation;
  onNavigateUsers?: (focus: PlatformUsersTabFocus) => void;
}) {
  const hasNarrowFilter = Boolean(
    rec.filter
    && (
      (rec.filter.tenantFilter && rec.filter.tenantFilter !== 'all')
      || (rec.filter.engagementFilter && rec.filter.engagementFilter !== 'all')
      || (rec.filter.roleFilter && rec.filter.roleFilter !== 'all')
    ),
  );
  return (
    <li className={`platform-security-rec platform-security-rec--${rec.priority}`}>
      <div className="platform-security-rec-main">
        <span className={`platform-security-rec-priority platform-security-rec-priority--${rec.priority}`}>
          {PRIORITY_LABELS[rec.priority] ?? rec.priority}
        </span>
        <div>
          <strong className="platform-security-rec-title">{rec.title}</strong>
          <p className="platform-muted platform-security-rec-desc">{rec.description}</p>
        </div>
      </div>
      <div className="platform-security-rec-actions">
        <span className="platform-security-rec-count">{rec.affectedCount}</span>
        {onNavigateUsers && (
          <button
            type="button"
            className="btn btn-text platform-security-rec-btn"
            onClick={() => {
              onNavigateUsers({
                tenantFilter: rec.filter?.tenantFilter,
                engagementFilter: (rec.filter?.engagementFilter as PlatformUsersTabFocus['engagementFilter']) ?? 'all',
                roleFilter: rec.filter?.roleFilter ?? 'all',
              });
            }}
          >
            {hasNarrowFilter ? 'Kullanıcı dizininde göster' : 'Kullanıcı işlemlerine git'}
          </button>
        )}
      </div>
    </li>
  );
}
