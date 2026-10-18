import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchPlatformAlerts,
  fetchPlatformCalendar,
  fetchPlatformTenantDetail,
  fetchPlatformTenants,
  type PlatformAlertRow,
  type PlatformCalendarDay,
  type PlatformDebtorRow,
  type PlatformPaymentRow,
  type PlatformTenantSummary,
  type PlatformTenantUserRow,
} from '../services/platformApi';
import { syncPosApiTokenToCurrentTenant } from '../services/posApiAuth';
import { saveTenantId } from '../storage/tenantSession';
import { KpiIcon, RingProgress } from './platformUserUi';

const PAYMENT_CATEGORY_LABELS: Record<string, string> = {
  rent: 'Kira',
  electricity: 'Elektrik',
  water: 'Su',
  internet: 'İnternet',
  tax: 'Vergi',
  phone: 'Telefon',
  insurance: 'Sigorta',
  salary: 'Personel',
  other: 'Diğer',
};

function formatTry(value: number): string {
  return `₺${value.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
}

function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

type Props = {
  refreshTick?: number;
};

function OverviewSkeleton() {
  return (
    <div className="platform-overview platform-overview--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

export function PlatformOverviewTab({ refreshTick = 0 }: Props) {
  const navigate = useNavigate();
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);

  const [tenants, setTenants] = useState<PlatformTenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailUsers, setDetailUsers] = useState<PlatformTenantUserRow[]>([]);
  const [detailDebtors, setDetailDebtors] = useState<PlatformDebtorRow[]>([]);
  const [detailPayments, setDetailPayments] = useState<PlatformPaymentRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [alerts, setAlerts] = useState<PlatformAlertRow[]>([]);
  const [alertsAsOf, setAlertsAsOf] = useState<string | null>(null);
  const [calendarDays, setCalendarDays] = useState<PlatformCalendarDay[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformTenants();
    if (!result.ok) {
      setError(result.error ?? 'Liste yüklenemedi');
      setTenants([]);
    } else {
      setTenants(result.tenants ?? []);
      setGeneratedAt(new Date().toISOString());
    }
    setLoading(false);
  }, []);

  const loadAlerts = useCallback(async () => {
    const result = await fetchPlatformAlerts();
    if (result.ok) {
      setAlerts(result.alerts ?? []);
      setAlertsAsOf(result.asOf ?? null);
    }
  }, []);

  const loadCalendar = useCallback(async () => {
    setCalendarLoading(true);
    const result = await fetchPlatformCalendar(calendarYear, calendarMonth);
    if (result.ok) {
      setCalendarDays(result.days ?? []);
    }
    setCalendarLoading(false);
  }, [calendarYear, calendarMonth]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTenants(), loadAlerts(), loadCalendar()]);
  }, [loadTenants, loadAlerts, loadCalendar]);

  useEffect(() => {
    void loadTenants();
    void loadAlerts();
  }, [loadTenants, loadAlerts, refreshTick]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar, refreshTick]);

  const totals = useMemo(() => {
    return tenants.reduce(
      (acc, t) => ({
        receivables: acc.receivables + (t.receivablesTotalTry ?? 0),
        collections: acc.collections + (t.collections30dTry ?? 0),
        overduePay: acc.overduePay + (t.overduePaymentAmountTry ?? 0),
        pendingPay: acc.pendingPay + (t.pendingPaymentAmountTry ?? 0),
        lowStock: acc.lowStock + (t.lowStockCount ?? 0),
        overdueCount: acc.overdueCount + (t.overduePaymentCount ?? 0),
      }),
      {
        receivables: 0,
        collections: 0,
        overduePay: 0,
        pendingPay: 0,
        lowStock: 0,
        overdueCount: 0,
      },
    );
  }, [tenants]);

  const alertStats = useMemo(() => {
    const critical = alerts.filter((a) => a.severity === 'critical').length;
    const warning = alerts.filter((a) => a.severity === 'warning').length;
    return { critical, warning, total: alerts.length };
  }, [alerts]);

  const collectionPulsePct = useMemo(() => {
    const base = totals.receivables + totals.collections;
    if (base <= 0) return totals.collections > 0 ? 100 : 0;
    return Math.min(100, Math.round((totals.collections / base) * 100));
  }, [totals]);

  const platformHealthPct = useMemo(() => {
    let score = 100;
    if (alertStats.critical > 0) score -= Math.min(35, alertStats.critical * 12);
    if (alertStats.warning > 0) score -= Math.min(20, alertStats.warning * 4);
    if (totals.overdueCount > 0) score -= Math.min(25, totals.overdueCount * 5);
    if (totals.lowStock > 0) score -= Math.min(15, Math.ceil(totals.lowStock / 3));
    return Math.max(0, Math.min(100, score));
  }, [alertStats, totals]);

  const healthVariant = platformHealthPct >= 75 ? 'brand' : 'warn';

  const openTenantPos = (tenantId: string) => {
    saveTenantId(tenantId);
    syncPosApiTokenToCurrentTenant();
    navigate('/app', { replace: true });
  };

  const showDetail = async (tenantId: string) => {
    setSelectedId(tenantId);
    setDetailLoading(true);
    setDetailUsers([]);
    setDetailDebtors([]);
    setDetailPayments([]);
    const result = await fetchPlatformTenantDetail(tenantId);
    if (result.ok && result.tenant) {
      setDetailUsers(result.tenant.users ?? []);
      setDetailDebtors(result.tenant.topDebtors ?? []);
      setDetailPayments(result.tenant.upcomingPayments ?? []);
    }
    setDetailLoading(false);
  };

  const shiftCalendarMonth = (delta: number) => {
    let m = calendarMonth + delta;
    let y = calendarYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setCalendarMonth(m);
    setCalendarYear(y);
  };

  const selected = tenants.find((t) => t.tenantId === selectedId);

  if (loading && tenants.length === 0) return <OverviewSkeleton />;

  return (
    <div className="platform-overview platform-overview--premium platform-users--premium">
      <header className="platform-users-hero platform-users-hero--premium platform-overview-hero">
        <div className="platform-users-hero-copy">
          <span className="platform-users-hero-badge">Platform Control</span>
          <h2>Genel bakış</h2>
          <p>
            Cari ve tahsilat, otomatik uyarılar ile fatura ve ödeme takvimi — tüm kiracılar tek konsolda.
          </p>
          <time className="platform-users-hero-time" dateTime={generatedAt ?? undefined}>
            Son güncelleme:{' '}
            {generatedAt
              ? new Date(generatedAt).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
              : alertsAsOf ?? '—'}
          </time>
        </div>
        <div className="platform-users-hero-actions">
          <div className="platform-overview-hero-metrics">
            <RingProgress
              pct={platformHealthPct}
              size={72}
              label="Sağlık"
              variant={healthVariant}
            />
            <span className="platform-users-hero-stat-label">Platform sağlık skoru</span>
          </div>
          <ul className="platform-overview-hero-chips" aria-label="Özet sinyaller">
            <li className={alertStats.critical > 0 ? 'is-warn' : 'is-ok'}>
              {alertStats.critical} kritik uyarı
            </li>
            <li className={totals.overdueCount > 0 ? 'is-warn' : 'is-ok'}>
              {totals.overdueCount} gecikmiş ödeme
            </li>
            <li className="is-muted">{tenants.length} kiracı</li>
          </ul>
          <button type="button" className="btn btn-primary platform-users-refresh" onClick={() => void refreshAll()}>
            Yenile
          </button>
        </div>
      </header>

      {error && (
        <p className="landing-flash landing-flash--error platform-overview-flash" role="alert">{error}</p>
      )}

      <div className="platform-users-kpi-grid platform-users-kpi-grid--premium" aria-label="Finansal özet">
        <article className="platform-users-kpi platform-users-kpi--primary">
          <KpiIcon name="users" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Toplam açık cari</span>
            <strong className="platform-users-kpi-value">{formatTry(totals.receivables)}</strong>
            <span className="platform-users-kpi-sub">{tenants.length} mağaza</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--ring">
          <RingProgress pct={collectionPulsePct} variant={collectionPulsePct >= 40 ? 'brand' : 'warn'} />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">30 gün tahsilat</span>
            <strong className="platform-users-kpi-value">{formatTry(totals.collections)}</strong>
            <div className="platform-users-login-rate">
              <div className="platform-users-login-rate-bar">
                <span style={{ width: `${collectionPulsePct}%` }} />
              </div>
              <span className="platform-users-kpi-sub">Tahsilat / (cari + tahsilat) oranı</span>
            </div>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--danger">
          <KpiIcon name="churn" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Gecikmiş ödemeler</span>
            <strong className="platform-users-kpi-value">{formatTry(totals.overduePay)}</strong>
            <span className="platform-users-kpi-sub">{totals.overdueCount} kayıt</span>
          </div>
        </article>
        <article className="platform-users-kpi platform-users-kpi--warn">
          <KpiIcon name="sleep" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Bekleyen yükümlülük</span>
            <strong className="platform-users-kpi-value">{formatTry(totals.pendingPay)}</strong>
            <span className="platform-users-kpi-sub">{alertStats.warning} uyarı sinyali</span>
          </div>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <div className="platform-users-kpi-body">
            <span className="platform-users-kpi-label">Stok uyarısı</span>
            <strong className="platform-users-kpi-value">{totals.lowStock}</strong>
            <span className="platform-users-kpi-sub">düşük stok kalemi</span>
          </div>
        </article>
      </div>

      <section className="platform-users-panel platform-overview-alerts" aria-label="Otomatik uyarılar">
        <div className="platform-users-panel-head">
          <h3>Otomatik uyarılar</h3>
          {alertsAsOf && <span className="platform-muted">Durum: {alertsAsOf}</span>}
        </div>
        {alerts.length === 0 ? (
          <p className="platform-muted platform-overview-empty">Kritik uyarı yok — tüm kiracılar stabil görünüyor.</p>
        ) : (
          <ul className="platform-overview-alert-list">
            {alerts.map((alert, index) => (
              <li
                key={`${alert.tenantId}-${alert.kind}-${index}`}
                className={`platform-overview-alert platform-overview-alert--${alert.severity}`}
              >
                <button
                  type="button"
                  className="platform-overview-alert-btn"
                  onClick={() => void showDetail(alert.tenantId)}
                >
                  <span className={`platform-overview-alert-badge platform-overview-alert-badge--${alert.severity}`}>
                    {alert.severity === 'critical' ? 'Kritik' : alert.severity === 'warning' ? 'Uyarı' : 'Bilgi'}
                  </span>
                  <span className="platform-overview-alert-store">{alert.businessName}</span>
                  <span className="platform-overview-alert-msg">{alert.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="platform-overview-layout">
        <section className="platform-users-panel platform-overview-tenants" aria-label="Kiracı listesi">
          <div className="platform-users-panel-head">
            <h3>Kiracı portföyü</h3>
            <span className="platform-muted">{tenants.length} mağaza</span>
          </div>
          {loading ? (
            <p className="platform-muted">Güncelleniyor…</p>
          ) : (
            <div className="platform-users-table-scroll">
              <table className="platform-table platform-table--premium">
                <thead>
                  <tr>
                    <th>Mağaza</th>
                    <th>Açık cari</th>
                    <th>30g tahsilat</th>
                    <th>Gecikmiş ödeme</th>
                    <th>Stok uyarı</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.tenantId} className={selectedId === t.tenantId ? 'platform-row--active' : ''}>
                      <td>
                        <strong>{t.businessName}</strong>
                        <div className="platform-muted">{t.label}</div>
                      </td>
                      <td>
                        {formatTry(t.receivablesTotalTry)}
                        {t.debtorsCount > 0 && (
                          <div className="platform-muted">{t.debtorsCount} müşteri</div>
                        )}
                      </td>
                      <td>{formatTry(t.collections30dTry)}</td>
                      <td>
                        {t.overduePaymentCount > 0 ? (
                          <span className="platform-overview-num is-danger">
                            {t.overduePaymentCount} · {formatTry(t.overduePaymentAmountTry)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {t.lowStockCount > 0 ? (
                          <span className="platform-overview-num is-warn">{t.lowStockCount}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="platform-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void showDetail(t.tenantId)}>
                          Detay
                        </button>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openTenantPos(t.tenantId)}>
                          POS aç
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="platform-users-panel platform-overview-detail" aria-label="Kiracı detayı">
          {!selected ? (
            <div className="platform-overview-detail-empty">
              <p className="platform-overview-detail-empty-title">Mağaza detayı</p>
              <p className="platform-muted">Cari, borçlu müşteriler ve yaklaşan ödemeler için listeden bir mağaza seçin.</p>
            </div>
          ) : (
            <>
              <div className="platform-overview-detail-head">
                <h3>{selected.businessName}</h3>
                <span className="platform-comms-tenant-pill">{selected.tenantId}</span>
              </div>
              <dl className="platform-overview-stats">
                <div><dt>Açık cari</dt><dd>{formatTry(selected.receivablesTotalTry)}</dd></div>
                <div><dt>30 gün tahsilat</dt><dd>{formatTry(selected.collections30dTry)}</dd></div>
                <div><dt>Bekleyen ödemeler</dt><dd>{formatTry(selected.pendingPaymentAmountTry)}</dd></div>
                <div><dt>Gecikmiş</dt><dd>{selected.overduePaymentCount || '—'}</dd></div>
              </dl>

              <h4>En borçlu müşteriler</h4>
              {detailLoading ? (
                <p className="platform-muted">Yükleniyor…</p>
              ) : detailDebtors.length === 0 ? (
                <p className="platform-muted">Açık cari yok.</p>
              ) : (
                <ul className="platform-overview-mini-list">
                  {detailDebtors.map((d) => (
                    <li key={d.customerId}>
                      <span>{d.name}</span>
                      <span className="platform-warn">{formatTry(d.balanceTry)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h4>Yaklaşan ödemeler & faturalar</h4>
              {detailPayments.length === 0 ? (
                <p className="platform-muted">Kayıtlı ödeme hatırlatıcısı yok.</p>
              ) : (
                <ul className="platform-overview-mini-list">
                  {detailPayments.map((p) => (
                    <li key={p.id}>
                      <span>{p.dueDate} — {p.title}</span>
                      <span className="platform-muted">
                        {PAYMENT_CATEGORY_LABELS[p.category ?? 'other'] ?? p.category}
                        {' · '}
                        {formatTry(p.amount)}
                        {p.status === 'paid' ? ' · ödendi' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <h4>Kullanıcılar & güvenlik</h4>
              <ul className="platform-overview-mini-list">
                {detailUsers.map((u) => (
                  <li key={u.id}>
                    <span>{u.displayName} ({u.username})</span>
                    <span className="platform-muted">
                      {u.role}
                      {!u.isActive ? ' · pasif' : ''}
                      {u.totpEnabled ? ' · 2FA' : ''}
                      {u.hasRecoveryEmail ? '' : ' · e-posta eksik'}
                    </span>
                  </li>
                ))}
              </ul>

              <button type="button" className="btn btn-primary platform-overview-open-pos" onClick={() => openTenantPos(selected.tenantId)}>
                Bu mağazada POS’a geç
              </button>
            </>
          )}
        </aside>
      </div>

      <section className="platform-users-panel platform-overview-calendar" aria-label="Birleşik ödeme takvimi">
        <div className="platform-users-panel-head">
          <h3>Fatura & ödeme takvimi</h3>
          <div className="platform-overview-calendar-nav">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftCalendarMonth(-1)} aria-label="Önceki ay">
              ←
            </button>
            <span>{monthLabel(calendarYear, calendarMonth)}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftCalendarMonth(1)} aria-label="Sonraki ay">
              →
            </button>
          </div>
        </div>
        {calendarLoading ? (
          <p className="platform-muted">Takvim yükleniyor…</p>
        ) : calendarDays.length === 0 ? (
          <p className="platform-muted platform-overview-empty">Bu ay için kayıtlı ödeme hatırlatıcısı yok.</p>
        ) : (
          <div className="platform-overview-calendar-grid">
            {calendarDays.map((day) => (
              <article key={day.dateKey} className="platform-overview-calendar-day">
                <header>
                  <time dateTime={day.dateKey}>{day.dateKey}</time>
                  {day.pendingCount > 0 && (
                    <span className="platform-overview-calendar-pending">
                      {day.pendingCount} bekleyen · {formatTry(day.pendingAmountTry)}
                    </span>
                  )}
                </header>
                <ul>
                  {day.items.map((item) => (
                    <li key={`${item.tenantId}-${item.id}`}>
                      <button
                        type="button"
                        className="platform-overview-calendar-item"
                        onClick={() => void showDetail(item.tenantId)}
                      >
                        <strong>{item.businessName}</strong>
                        <span>{item.title} — {formatTry(item.amount)}</span>
                        <span className="platform-muted">
                          {PAYMENT_CATEGORY_LABELS[item.category ?? 'other']}
                          {item.status === 'paid' ? ' · ödendi' : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
