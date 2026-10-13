import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadPlatformBillingCsv,
  fetchPlatformBillingOverview,
  type PlatformBillingPayload,
} from '../services/platformApi';
import { KpiIcon, PlatformFilterSelect, RingProgress } from './platformUserUi';

function formatTry(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function BillingSkeleton() {
  return (
    <div className="platform-billing platform-billing--loading" aria-busy="true">
      <div className="platform-users-skeleton-hero" />
      <div className="platform-users-skeleton-kpis" />
      <div className="platform-users-skeleton-block" />
    </div>
  );
}

export function PlatformBillingTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlatformBillingPayload | null>(null);
  const [windowDays, setWindowDays] = useState(30);
  const [exporting, setExporting] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPlatformBillingOverview(windowDays);
    if (!result.ok || !result.data) {
      setError(result.error ?? 'Veri yüklenemedi');
      setLoading(false);
      return;
    }
    setData(result.data);
    setLoading(false);
  }, [windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const maxDailyRevenue = useMemo(() => {
    if (!data?.revenueByDay.length) return 1;
    return Math.max(1, ...data.revenueByDay.map((d) => d.revenueTry));
  }, [data]);

  const collectionRing = data?.totals.portfolioCollectionRatePercent ?? 0;

  const onExport = async () => {
    setExporting(true);
    const result = await downloadPlatformBillingCsv(windowDays);
    setExporting(false);
    if (!result.ok) setActionMsg(result.error ?? 'CSV indirilemedi');
  };

  if (loading && !data) return <BillingSkeleton />;
  if (error && !data) {
    return (
      <div className="platform-billing platform-panel">
        <p className="platform-error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>
          Yeniden dene
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { totals } = data;

  return (
    <div className="platform-billing">
      <section className="platform-users-hero platform-billing-hero">
        <div>
          <h2>Gelir & faturalandırma</h2>
          <p>
            Kiracı POS ciro ve cari özetleri; tahmini SaaS MRR plan tablosuna göre hesaplanır.
          </p>
          <p className="platform-billing-note">{data.planPricingNote}</p>
        </div>
        <div className="platform-billing-hero-actions">
          <PlatformFilterSelect
            label="Pencere"
            icon="status"
            value={String(windowDays)}
            onChange={(v) => setWindowDays(Number(v))}
          >
            <option value="7">7 gün</option>
            <option value="14">14 gün</option>
            <option value="30">30 gün</option>
            <option value="90">90 gün</option>
          </PlatformFilterSelect>
          <button type="button" className="btn btn-text" onClick={() => void load()} disabled={loading}>
            Yenile
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => void onExport()} disabled={exporting}>
            {exporting ? 'İndiriliyor…' : 'CSV'}
          </button>
        </div>
      </section>

      {actionMsg ? <p className="platform-inline-msg">{actionMsg}</p> : null}

      <div className="platform-users-kpi-grid">
        <article className="platform-users-kpi platform-users-kpi--accent">
          <KpiIcon name="login" />
          <span className="platform-users-kpi-label">{data.windowDays} gün ciro</span>
          <strong className="platform-users-kpi-value">{formatTry(totals.revenueWindowTry)}</strong>
          <span className="platform-users-kpi-sub">{totals.salesWindow} satış</span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="active" />
          <span className="platform-users-kpi-label">7 gün ciro</span>
          <strong className="platform-users-kpi-value">{formatTry(totals.revenue7dTry)}</strong>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="users" />
          <span className="platform-users-kpi-label">Açık cari</span>
          <strong className="platform-users-kpi-value">{formatTry(totals.receivablesTotalTry)}</strong>
          <span className="platform-users-kpi-sub">{totals.debtorsCount} borçlu</span>
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="roles" />
          <span className="platform-users-kpi-label">30 gün tahsilat</span>
          <strong className="platform-users-kpi-value">{formatTry(totals.collections30dTry)}</strong>
        </article>
        <article className="platform-users-kpi platform-billing-kpi-ring">
          <RingProgress
            pct={collectionRing}
            label="Tahsilat oranı"
            variant={collectionRing >= 40 ? 'brand' : 'warn'}
          />
        </article>
        <article className="platform-users-kpi">
          <KpiIcon name="churn" />
          <span className="platform-users-kpi-label">Gecikmiş ödemeler</span>
          <strong className="platform-users-kpi-value">{formatTry(totals.overduePaymentAmountTry)}</strong>
          <span className="platform-users-kpi-sub">{totals.overduePaymentCount} kalem</span>
        </article>
        <article className="platform-users-kpi platform-users-kpi--premium">
          <KpiIcon name="sleep" />
          <span className="platform-users-kpi-label">Tahmini MRR</span>
          <strong className="platform-users-kpi-value">{formatTry(totals.estimatedMrrTry)}</strong>
          <span className="platform-users-kpi-sub">
            ARR {formatTry(totals.estimatedArrTry)} · {totals.billableTenants} faturalı plan
          </span>
        </article>
      </div>

      <div className="platform-billing-columns">
        <section className="platform-panel platform-billing-chart">
          <h3>Günlük ciro</h3>
          <div className="platform-billing-bars" role="img" aria-label="Günlük ciro grafiği">
            {data.revenueByDay.map((d) => (
              <div key={d.date} className="platform-billing-bar-wrap" title={`${d.date}: ${formatTry(d.revenueTry)}`}>
                <div
                  className="platform-billing-bar"
                  style={{ height: `${Math.max(4, (d.revenueTry / maxDailyRevenue) * 100)}%` }}
                />
                <span className="platform-billing-bar-label">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="platform-panel platform-billing-plans">
          <h3>Plan dağılımı</h3>
          <table className="platform-table platform-table--compact">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Kiracı</th>
                <th>MRR / kiracı</th>
                <th>Toplam MRR</th>
              </tr>
            </thead>
            <tbody>
              {data.planMix.map((p) => (
                <tr key={p.plan}>
                  <td>{p.plan}</td>
                  <td>{p.count}</td>
                  <td>{formatTry(p.mrrPerTenantTry)}</td>
                  <td>{formatTry(p.mrrTotalTry)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="platform-panel">
        <h3>En borçlu müşteriler (tüm kiracılar)</h3>
        <table className="platform-table">
          <thead>
            <tr>
              <th>Kiracı</th>
              <th>Müşteri</th>
              <th>Bakiye</th>
            </tr>
          </thead>
          <tbody>
            {data.topDebtors.length === 0 ? (
              <tr>
                <td colSpan={3}>Kayıt yok</td>
              </tr>
            ) : (
              data.topDebtors.map((d) => (
                <tr key={`${d.tenantId}-${d.customerId}`}>
                  <td>{d.businessName}</td>
                  <td>{d.name}</td>
                  <td>{formatTry(d.balanceTry)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="platform-panel">
        <h3>Kiracı gelir tablosu</h3>
        <table className="platform-table platform-table--scroll">
          <thead>
            <tr>
              <th>Mağaza</th>
              <th>Plan</th>
              <th>Durum</th>
              <th>{data.windowDays}g ciro</th>
              <th>Cari</th>
              <th>30g tahsilat</th>
              <th>Tahmini MRR</th>
            </tr>
          </thead>
          <tbody>
            {data.tenants.map((t) => (
              <tr key={t.tenantId}>
                <td>
                  <span className="platform-table-primary">{t.businessName}</span>
                  <span className="platform-table-muted">{t.tenantId}</span>
                </td>
                <td>{t.plan}</td>
                <td>{t.lifecycleStatus}</td>
                <td>{formatTry(t.revenueWindowTry)}</td>
                <td>{formatTry(t.receivablesTotalTry)}</td>
                <td>{formatTry(t.collections30dTry)}</td>
                <td>{formatTry(t.estimatedMrrTry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
