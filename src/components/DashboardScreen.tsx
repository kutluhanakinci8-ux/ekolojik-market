import { useEffect, useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import { estimateProfit, getPaymentBreakdown, getTopProducts } from '../utils/analytics';
import { formatCurrency, formatDateTime } from '../utils/format';
import { getPaymentReminderAlerts } from '../utils/paymentReminderAnalytics';
import { DashboardUserActivitySection } from './DashboardUserActivitySection';
import { DashboardWidgetPicker } from './DashboardWidgetPicker';
import { DisplayCurrencyPanel, DisplayCurrencyToolbarTail } from './DisplayCurrencyPanel';
import { PaymentCalendarPanel } from './PaymentCalendarPanel';
import { DashboardCrmSummaryPanel } from './crm/DashboardCrmSummaryPanel';
import { PaymentAlertTicker } from './PaymentAlertTicker';
import { ProductImage } from './ProductImage';
import { isPosLiteProfile } from '../utils/tenantProductProfile';

interface DashboardScreenProps {
  store: Store;
}

type PaymentViewMode = 'bars' | 'chart';

const PAYMENT_ROWS = [
  { key: 'cash' as const, label: 'Nakit', icon: '💵', color: '#51b848' },
  { key: 'card' as const, label: 'Kart', icon: '💳', color: '#2563eb' },
  { key: 'transfer' as const, label: 'Havale', icon: '🏦', color: '#8b5cf6' },
];

const PAYMENT_LABELS = {
  cash: '💵 Nakit',
  card: '💳 Kart',
  transfer: '🏦 Havale',
  credit: '📝 Veresiye',
  split: '🔀 Bölünmüş',
};

function buildDonutGradient(
  segments: Array<{ value: number; color: string }>,
  total: number,
): string {
  if (total <= 0) return '#e8f5e6';

  let cumulative = 0;
  const stops = segments
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const pct = (segment.value / total) * 100;
      const start = cumulative;
      cumulative += pct;
      return `${segment.color} ${start}% ${cumulative}%`;
    });

  if (stops.length === 0) return '#e8f5e6';
  return `conic-gradient(${stops.join(', ')})`;
}

export function DashboardScreen({ store }: DashboardScreenProps) {
  const [paymentView, setPaymentView] = useState<PaymentViewMode>('bars');
  const payment = getPaymentBreakdown(store.todaySales, store.todayReturns);
  const topProducts = getTopProducts(store.todaySales, store.products, 5);
  const todayProfit = estimateProfit(store.todaySales, store.products);
  const netCash = store.todayTotal - store.todayExpenseTotal;

  const paymentSegments = PAYMENT_ROWS.map((row) => ({
    ...row,
    value: payment[row.key],
    pct: store.todayTotal > 0 ? Math.round((payment[row.key] / store.todayTotal) * 100) : 0,
  }));

  const donutGradient = buildDonutGradient(
    paymentSegments.map((row) => ({ value: row.value, color: row.color })),
    store.todayTotal,
  );

  const posLite = isPosLiteProfile(store.settings);
  const isAdmin = store.authSession?.role === 'admin';
  const isPrimaryAdmin = Boolean(
    store.users.find((user) => user.id === store.authSession?.userId)?.isPrimaryAdmin,
  );
  const widgets = store.settings.dashboardWidgets;
  const paymentAlerts = useMemo(
    () => (isAdmin ? getPaymentReminderAlerts(store.settings.paymentReminders) : {
      overdue: [],
      dueToday: [],
      dueTomorrow: [],
    }),
    [isAdmin, store.settings.paymentReminders],
  );
  useEffect(() => {
    if (posLite || !isAdmin || !store.crmSettings.automationEnabled) return;
    store.runCrmDailyAutomation();
  }, [posLite, isAdmin, store]);

  const visibleWidgetCount = [
    widgets.payment,
    widgets.topProducts,
    widgets.stockAlerts,
    widgets.recentSales,
    isAdmin && widgets.userActivity,
    isAdmin && widgets.paymentCalendar,
    isAdmin && widgets.crmSummary,
  ].filter(Boolean).length;

  return (
    <div className="module-screen dashboard-screen--premium">
      <header className="dashboard-hero dashboard-hero--compact">
        <div className="dashboard-hero-row dashboard-hero-row--split">
          <div className="dashboard-hero-intro">
            <span className="dashboard-hero-badge" aria-hidden>📊</span>
            <h1>İşletme Paneli</h1>
          </div>

          <div className="dashboard-kpi-strip">
            <div className="dashboard-kpi dashboard-kpi--compact dashboard-kpi--green">
              <span className="dashboard-kpi-icon" aria-hidden>💰</span>
              <div className="dashboard-kpi-body">
                <span className="dashboard-kpi-label">Bugün Ciro</span>
                <strong>{formatCurrency(store.todayTotal)}</strong>
                <small>{store.todaySales.length} satış</small>
              </div>
            </div>
            <div className="dashboard-kpi dashboard-kpi--compact">
              <span className="dashboard-kpi-icon" aria-hidden>📅</span>
              <div className="dashboard-kpi-body">
                <span className="dashboard-kpi-label">7 Gün Ciro</span>
                <strong>{formatCurrency(store.weekTotal)}</strong>
                <small>{store.weekSales.length} işlem</small>
              </div>
            </div>
            <div className="dashboard-kpi dashboard-kpi--compact dashboard-kpi--blue">
              <span className="dashboard-kpi-icon" aria-hidden>📈</span>
              <div className="dashboard-kpi-body">
                <span className="dashboard-kpi-label">Tahmini Kâr</span>
                <strong>{formatCurrency(todayProfit)}</strong>
                <small>Alış fiyatına göre</small>
              </div>
            </div>
            <div className="dashboard-kpi dashboard-kpi--compact dashboard-kpi--warn">
              <span className="dashboard-kpi-icon" aria-hidden>🏦</span>
              <div className="dashboard-kpi-body">
                <span className="dashboard-kpi-label">Net Kasa</span>
                <strong>{formatCurrency(netCash)}</strong>
                <small>Gider: {formatCurrency(store.todayExpenseTotal)}</small>
              </div>
            </div>
          </div>
        </div>

        <div className="dashboard-hero-controls dashboard-hero-toolbar">
          {isAdmin && <DisplayCurrencyPanel store={store} layout="toolbar" />}
          <DashboardWidgetPicker store={store} isAdmin={isAdmin} />
          {isAdmin && <DisplayCurrencyToolbarTail store={store} />}
        </div>

        {isAdmin && !posLite && (
          <PaymentAlertTicker alerts={paymentAlerts} />
        )}
      </header>

      <div className={`dashboard-grid ${visibleWidgetCount === 1 ? 'dashboard-grid--single' : ''}`}>
        {widgets.payment && (
        <section className="dashboard-card dashboard-payment-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <h2>Ödeme Dağılımı (Bugün)</h2>
              <button
                type="button"
                className={`dashboard-chart-toggle ${paymentView === 'chart' ? 'is-active' : ''}`}
                onClick={() => setPaymentView((current) => (current === 'chart' ? 'bars' : 'chart'))}
                aria-label={paymentView === 'chart' ? 'Liste görünümüne geç' : 'Grafik görünümüne geç'}
                aria-pressed={paymentView === 'chart'}
                title={paymentView === 'chart' ? 'Liste görünümü' : 'Grafik görünümü'}
              >
                <span aria-hidden>📊</span>
              </button>
            </div>
            <span className="dashboard-card-subtitle">{formatCurrency(store.todayTotal)} toplam</span>
          </div>

          {paymentView === 'bars' ? (
            <div className="dashboard-payment-bars">
              {paymentSegments.map((row) => (
                <div key={row.key} className="dashboard-payment-bar-row">
                  <div className="dashboard-payment-bar-label">
                    <span>{row.icon} {row.label}</span>
                    <strong>{formatCurrency(row.value)}</strong>
                  </div>
                  <div className="dashboard-payment-bar-track">
                    <div
                      className="dashboard-payment-bar-fill"
                      style={{ width: `${row.pct}%`, background: row.color }}
                    />
                  </div>
                  <span className="dashboard-payment-bar-pct">{row.pct}%</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="dashboard-payment-chart">
              <div
                className="dashboard-donut"
                style={{ background: donutGradient }}
                role="img"
                aria-label="Bugünkü ödeme dağılımı grafiği"
              >
                <div className="dashboard-donut-hole">
                  <strong>{formatCurrency(store.todayTotal)}</strong>
                  <span>Toplam</span>
                </div>
              </div>
              <ul className="dashboard-chart-legend">
                {paymentSegments.map((row) => (
                  <li key={row.key}>
                    <span className="dashboard-chart-legend-dot" style={{ background: row.color }} aria-hidden />
                    <div>
                      <strong>{row.icon} {row.label}</strong>
                      <span>{formatCurrency(row.value)} · {row.pct}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
        )}

        {widgets.topProducts && (
        <section className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>En Çok Satanlar (Bugün)</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="module-empty">Henüz satış yok</p>
          ) : (
            <ul className="dashboard-product-list">
              {topProducts.map((row, index) => (
                <li key={row.product!.id} className="dashboard-product-item">
                  <span className="dashboard-product-rank">{index + 1}</span>
                  <div className="dashboard-product-image">
                    <ProductImage product={row.product!} size="sm" />
                  </div>
                  <div className="dashboard-product-body">
                    <strong>{row.product!.name}</strong>
                    <span>{row.qty} adet · {formatCurrency(row.revenue)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}

        {widgets.stockAlerts && (
        <section className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Stok Uyarıları</h2>
          </div>
          <div className="dashboard-alert-grid">
            <div className="dashboard-alert dashboard-alert--danger">
              <span className="dashboard-alert-icon" aria-hidden>🚫</span>
              <div>
                <span>Tükenen</span>
                <strong>{store.outOfStockCount}</strong>
              </div>
            </div>
            <div className="dashboard-alert dashboard-alert--warn">
              <span className="dashboard-alert-icon" aria-hidden>⚠️</span>
              <div>
                <span>Az Stok ≤{store.lowStockThreshold}</span>
                <strong>{store.lowStockCount}</strong>
              </div>
            </div>
            <div className="dashboard-alert">
              <span className="dashboard-alert-icon" aria-hidden>📦</span>
              <div>
                <span>Toplam Stok</span>
                <strong>{store.totalStockUnits.toLocaleString('tr-TR')}</strong>
              </div>
            </div>
          </div>
        </section>
        )}

        {widgets.recentSales && (
        <section className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Son Satışlar</h2>
          </div>
          {store.todaySales.length === 0 ? (
            <p className="module-empty">Bugün satış yok</p>
          ) : (
            <ul className="dashboard-sale-list">
              {store.todaySales.slice(0, 6).map((sale) => (
                <li key={sale.id} className="dashboard-sale-item">
                  <div className="dashboard-sale-main">
                    <strong>{formatCurrency(sale.total)}</strong>
                    <span>{PAYMENT_LABELS[sale.paymentMethod]}</span>
                  </div>
                  <div className="dashboard-sale-meta">
                    <span className="mono">{sale.id}</span>
                    <span>{sale.items.reduce((sum, item) => sum + item.quantity, 0)} adet</span>
                    <span>{formatDateTime(sale.createdAt)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        )}

        {isAdmin && widgets.paymentCalendar && !posLite && (
          <PaymentCalendarPanel store={store} />
        )}

        {isAdmin && widgets.crmSummary && !posLite && (
          <DashboardCrmSummaryPanel store={store} />
        )}

        {isAdmin && widgets.userActivity && (
          <DashboardUserActivitySection store={store} isPrimaryAdmin={isPrimaryAdmin} />
        )}

        {visibleWidgetCount === 0 && (
          <section className="dashboard-card dashboard-card--empty">
            <p className="module-empty">Gösterilecek kart seçilmedi. Üstteki <strong>Kartlar</strong> menüsünden panel kartlarını açın.</p>
          </section>
        )}
      </div>
    </div>
  );
}
