import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useStore } from '../store/StoreProvider';
import {
  decodePosApiTokenClaims,
  loadPosApiToken,
  syncPosApiTokenToCurrentTenant,
} from '../services/posApiAuth';
import { isPlatformApiRole } from '../config/platformOperators';
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
import { saveTenantId } from '../storage/tenantSession';
import { PlatformSecurityTab } from './PlatformSecurityTab';
import { PlatformUsersTab, type PlatformUsersTabFocus } from './PlatformUsersTab';
import './platform.css';

type PlatformTab = 'overview' | 'users' | 'security';

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

export function PlatformApp() {
  const store = useStore();
  const navigate = useNavigate();
  const claims = decodePosApiTokenClaims(loadPosApiToken());
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
  const [activeTab, setActiveTab] = useState<PlatformTab>('overview');
  const [usersTabFocus, setUsersTabFocus] = useState<PlatformUsersTabFocus | null>(null);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformTenants();
    if (!result.ok) {
      setError(result.error ?? 'Liste yüklenemedi');
      setTenants([]);
    } else {
      setTenants(result.tenants ?? []);
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

  useEffect(() => {
    void loadTenants();
    void loadAlerts();
  }, [loadTenants, loadAlerts]);

  useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const totals = useMemo(() => {
    return tenants.reduce(
      (acc, t) => ({
        receivables: acc.receivables + (t.receivablesTotalTry ?? 0),
        collections: acc.collections + (t.collections30dTry ?? 0),
        overduePay: acc.overduePay + (t.overduePaymentAmountTry ?? 0),
      }),
      { receivables: 0, collections: 0, overduePay: 0 },
    );
  }, [tenants]);

  if (!store.authSession || !isPlatformApiRole(claims?.role)) {
    return <Navigate to="/giris" replace />;
  }

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

  return (
    <div className="platform-shell">
      <header className="platform-header">
        <div>
          <h1>Ekolojik Platform</h1>
          <p className="platform-subtitle">
            Cari & tahsilat · otomatik uyarılar · fatura & ödeme takvimi (tüm kiracılar)
          </p>
        </div>
        <div className="platform-header-actions">
          <span className="platform-user">{store.authSession.displayName}</span>
          <button type="button" className="btn btn-text" onClick={() => void loadTenants()}>
            Yenile
          </button>
          <button type="button" className="btn btn-text" onClick={() => store.logout()}>
            Çıkış
          </button>
        </div>
      </header>

      <nav className="platform-tabs" aria-label="Platform bölümleri">
        <button
          type="button"
          className={`platform-tab ${activeTab === 'overview' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Genel bakış
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'users' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Kullanıcı işlemleri
        </button>
        <button
          type="button"
          className={`platform-tab ${activeTab === 'security' ? 'platform-tab--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Güvenlik
        </button>
      </nav>

      {activeTab === 'security' ? (
        <PlatformSecurityTab
          onNavigateUsers={(focus) => {
            setUsersTabFocus(focus);
            setActiveTab('users');
          }}
        />
      ) : activeTab === 'users' ? (
        <PlatformUsersTab
          focus={usersTabFocus}
          onFocusApplied={() => setUsersTabFocus(null)}
        />
      ) : (
        <>
      {error && <p className="landing-flash landing-flash--error" role="alert">{error}</p>}

      <section className="platform-kpi-row" aria-label="Özet metrikler">
        <div className="platform-kpi">
          <span className="platform-kpi-label">Toplam açık cari</span>
          <strong>{formatTry(totals.receivables)}</strong>
        </div>
        <div className="platform-kpi">
          <span className="platform-kpi-label">30 gün tahsilat</span>
          <strong>{formatTry(totals.collections)}</strong>
        </div>
        <div className="platform-kpi">
          <span className="platform-kpi-label">Gecikmiş ödemeler</span>
          <strong className={totals.overduePay > 0 ? 'platform-warn' : ''}>{formatTry(totals.overduePay)}</strong>
        </div>
      </section>

      <section className="platform-alerts" aria-label="Otomatik uyarılar">
        <div className="platform-section-head">
          <h2>Otomatik uyarılar</h2>
          {alertsAsOf && <span className="platform-muted">Durum: {alertsAsOf}</span>}
        </div>
        {alerts.length === 0 ? (
          <p className="platform-muted">Kritik uyarı yok.</p>
        ) : (
          <ul className="platform-alert-list">
            {alerts.map((alert, index) => (
              <li
                key={`${alert.tenantId}-${alert.kind}-${index}`}
                className={`platform-alert platform-alert--${alert.severity}`}
              >
                <button
                  type="button"
                  className="platform-alert-btn"
                  onClick={() => void showDetail(alert.tenantId)}
                >
                  <span className="platform-alert-store">{alert.businessName}</span>
                  <span>{alert.message}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="platform-layout">
        <section className="platform-tenant-list" aria-label="Kiracı listesi">
          {loading ? (
            <p>Yükleniyor…</p>
          ) : (
            <table className="platform-table">
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
                    <td className={t.overduePaymentCount > 0 ? 'platform-warn' : ''}>
                      {t.overduePaymentCount > 0
                        ? `${t.overduePaymentCount} · ${formatTry(t.overduePaymentAmountTry)}`
                        : '—'}
                    </td>
                    <td className={t.lowStockCount > 0 ? 'platform-warn' : ''}>{t.lowStockCount || '—'}</td>
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
          )}
        </section>

        <aside className="platform-detail" aria-label="Kiracı detayı">
          {!selected ? (
            <p className="platform-muted">Cari ve ödeme detayı için bir mağaza seçin.</p>
          ) : (
            <>
              <h2>{selected.businessName}</h2>
              <dl className="platform-stats">
                <div><dt>Açık cari</dt><dd>{formatTry(selected.receivablesTotalTry)}</dd></div>
                <div><dt>30 gün tahsilat</dt><dd>{formatTry(selected.collections30dTry)}</dd></div>
                <div><dt>Bekleyen ödemeler</dt><dd>{formatTry(selected.pendingPaymentAmountTry)}</dd></div>
                <div><dt>Gecikmiş</dt><dd>{selected.overduePaymentCount || '—'}</dd></div>
              </dl>

              <h3>En borçlu müşteriler</h3>
              {detailLoading ? (
                <p>Yükleniyor…</p>
              ) : detailDebtors.length === 0 ? (
                <p className="platform-muted">Açık cari yok.</p>
              ) : (
                <ul className="platform-user-list">
                  {detailDebtors.map((d) => (
                    <li key={d.customerId}>
                      <span>{d.name}</span>
                      <span className="platform-warn">{formatTry(d.balanceTry)}</span>
                    </li>
                  ))}
                </ul>
              )}

              <h3>Yaklaşan ödemeler & faturalar</h3>
              {detailPayments.length === 0 ? (
                <p className="platform-muted">Kayıtlı ödeme hatırlatıcısı yok.</p>
              ) : (
                <ul className="platform-user-list">
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

              <h3>Kullanıcılar & güvenlik</h3>
              <ul className="platform-user-list">
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

              <button type="button" className="btn btn-primary platform-open-pos" onClick={() => openTenantPos(selected.tenantId)}>
                Bu mağazada POS’a geç
              </button>
            </>
          )}
        </aside>
      </div>

      <section className="platform-calendar" aria-label="Birleşik ödeme takvimi">
        <div className="platform-section-head">
          <h2>Fatura & ödeme takvimi (tüm kiracılar)</h2>
          <div className="platform-calendar-nav">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftCalendarMonth(-1)}>
              ←
            </button>
            <span>{monthLabel(calendarYear, calendarMonth)}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => shiftCalendarMonth(1)}>
              →
            </button>
          </div>
        </div>
        {calendarLoading ? (
          <p>Yükleniyor…</p>
        ) : calendarDays.length === 0 ? (
          <p className="platform-muted">Bu ay için kayıtlı ödeme hatırlatıcısı yok.</p>
        ) : (
          <div className="platform-calendar-grid">
            {calendarDays.map((day) => (
              <article key={day.dateKey} className="platform-calendar-day">
                <header>
                  <time dateTime={day.dateKey}>{day.dateKey}</time>
                  {day.pendingCount > 0 && (
                    <span className="platform-calendar-pending">
                      {day.pendingCount} bekleyen · {formatTry(day.pendingAmountTry)}
                    </span>
                  )}
                </header>
                <ul>
                  {day.items.map((item) => (
                    <li key={`${item.tenantId}-${item.id}`}>
                      <button
                        type="button"
                        className="platform-calendar-item"
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
        </>
      )}
    </div>
  );
}
