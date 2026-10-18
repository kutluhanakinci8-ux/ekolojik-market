import { useEffect, useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import type { Sale } from '../types/product';
import {
  CASHIER_PRIVACY_NOTICE,
  displayCustomerName,
  filterReturnsForCashier,
  filterSalesForCashier,
  isCashierSession,
} from '../utils/cashierPrivacy';
import type { ReportPeriod } from '../utils/analytics';
import { filterSalesByPeriod } from '../utils/analytics';
import { formatCurrency, formatDateTime } from '../utils/format';
import { filterReturnsByPeriod } from '../utils/saleReturn';
import { formatReturnReceiptToastMessage, printSaleReturnReceipt } from '../utils/returnReceiptPrint';
import { canReturnSale, getSaleNetTotal, getSaleStatus } from '../utils/saleReturn';
import { PurchaseInvoicesPanel } from './PurchaseInvoicesPanel';
import { SaleReturnModal } from './SaleReturnModal';

interface TransactionsScreenProps {
  store: Store;
  /** Muhasebe alt sekmesi olarak gösterildiğinde üst başlık gizlenir */
  embedded?: boolean;
  /** Raporlar → İşlemler: premium üst panel ve dönem filtresi */
  reportsPremium?: boolean;
  period?: ReportPeriod;
  /** Raporlar sol menü alt sekmesi (premium modda üstten kontrol) */
  transactionsTab?: TransactionsTab;
  onTransactionsTabChange?: (tab: TransactionsTab) => void;
}

const PAYMENT_LABELS = { cash: '💵 Nakit', card: '💳 Kart', transfer: '🏦 Havale', credit: '📝 Veresiye', split: '🔀 Bölünmüş' };

export type TransactionsTab = 'sales' | 'returns' | 'purchases';

export const TRANSACTIONS_REPORT_VIEWS: { id: TransactionsTab; label: string }[] = [
  { id: 'sales', label: 'Satış' },
  { id: 'returns', label: 'İade' },
  { id: 'purchases', label: 'Alış faturası' },
];

const STATUS_LABELS = {
  completed: 'Tamamlandı',
  partially_returned: 'Kısmi iade',
  fully_returned: 'İade edildi',
};

export function TransactionsScreen({
  store,
  embedded = false,
  reportsPremium = false,
  period,
  transactionsTab: controlledTab,
  onTransactionsTabChange,
}: TransactionsScreenProps) {
  const isCashier = isCashierSession(store.authSession);
  const [internalTab, setInternalTab] = useState<TransactionsTab>('sales');
  const tab = controlledTab ?? internalTab;
  const setTab = onTransactionsTabChange ?? setInternalTab;
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<'all' | 'cash' | 'card' | 'transfer'>('all');
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const visibleSales = useMemo(() => {
    let list = isCashier ? filterSalesForCashier(store.sales) : store.sales;
    if (reportsPremium && period) {
      list = filterSalesByPeriod(list, period);
    }
    return list;
  }, [isCashier, store.sales, reportsPremium, period]);

  const visibleReturns = useMemo(() => {
    let list = isCashier
      ? filterReturnsForCashier(store.saleReturns, store.sales)
      : store.saleReturns;
    if (reportsPremium && period) {
      list = filterReturnsByPeriod(list, period);
    }
    return list;
  }, [isCashier, store.saleReturns, store.sales, reportsPremium, period]);

  useEffect(() => {
    if (isCashier && tab === 'purchases') setTab('sales');
  }, [isCashier, tab]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleSales.filter((sale) => {
      if (method !== 'all' && sale.paymentMethod !== method) return false;
      if (!q) return true;
      const customer = sale.customerId
        ? store.customers.find((c) => c.id === sale.customerId)
        : undefined;
      const customerLabel = isCashier
        ? ''
        : (sale.customerName ?? customer?.name ?? '');
      return (
        sale.id.toLowerCase().includes(q)
        || String(sale.total).includes(q)
        || customerLabel.toLowerCase().includes(q)
        || sale.greenleafNumber?.toLowerCase().includes(q)
        || sale.cashierName?.toLowerCase().includes(q)
      );
    });
  }, [visibleSales, store.customers, search, method, isCashier]);

  const filteredReturns = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleReturns.filter((entry) => {
      if (method !== 'all' && entry.refundMethod !== method) return false;
      if (!q) return true;
      const sale = store.sales.find((item) => item.id === entry.originalSaleId);
      return (
        entry.id.toLowerCase().includes(q)
        || entry.originalSaleId.toLowerCase().includes(q)
        || entry.cashierName?.toLowerCase().includes(q)
        || (!isCashier && sale?.customerName?.toLowerCase().includes(q))
        || sale?.greenleafNumber?.toLowerCase().includes(q)
      );
    });
  }, [visibleReturns, store.sales, search, method, isCashier]);

  const salesTotal = filteredSales.reduce((sum, sale) => sum + getSaleNetTotal(sale, store.saleReturns), 0);
  const returnsTotal = filteredReturns.reduce((sum, entry) => sum + entry.refundTotal, 0);
  const grossSalesTotal = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
  const avgTicket = filteredSales.length > 0 ? salesTotal / filteredSales.length : 0;

  const paymentMix = useMemo(() => {
    const mix = { cash: 0, card: 0, transfer: 0, credit: 0 };
    for (const sale of filteredSales) {
      const net = getSaleNetTotal(sale, store.saleReturns);
      if (sale.paymentMethod === 'split' && sale.paymentSplits?.length) {
        for (const split of sale.paymentSplits) {
          if (split.method in mix) mix[split.method] += split.amount;
        }
      } else if (sale.paymentMethod !== 'split' && sale.paymentMethod in mix) {
        mix[sale.paymentMethod] += net;
      }
    }
    return mix;
  }, [filteredSales, store.saleReturns]);

  const resolveCustomerLabel = (sale: Sale) => {
    if (sale.customerName) return displayCustomerName(sale.customerName, isCashier);
    if (sale.customerId) {
      const customer = store.customers.find((c) => c.id === sale.customerId);
      return displayCustomerName(customer?.name, isCashier);
    }
    return '—';
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3500);
  };

  const resolveLineName = (item: Sale['items'][number]) => {
    if (item.setId) {
      return store.productSets.find((set) => set.id === item.setId)?.name ?? `Set ${item.setId}`;
    }
    const product = store.products.find((p) => p.id === item.productId);
    return product?.name ?? `Ürün #${item.productId}`;
  };

  const premiumHead = reportsPremium && embedded;

  return (
    <div className={`module-screen ${embedded ? 'transactions-screen--embedded' : ''} ${premiumHead ? 'transactions-screen--reports-premium' : ''}`}>
      {toast && <div className="sale-toast" role="status">✓ {toast}</div>}

      {premiumHead ? (
        <section className="tx-reports-hero" aria-label="İşlem raporu özet">
          <div className="tx-reports-hero-glow" aria-hidden="true" />
          <div className="tx-reports-hero-main tx-reports-hero-main--solo">
            <div className="tx-reports-hero-copy">
              <span className="tx-reports-eyebrow">İşlem merkezi</span>
              <h2 className="tx-reports-title">Satış, iade ve alış hareketleri</h2>
            </div>
          </div>
          <div className="tx-reports-kpi-grid">
            <article className="tx-reports-kpi tx-reports-kpi--primary">
              <span className="tx-reports-kpi-icon" aria-hidden>🧾</span>
              <div>
                <span className="tx-reports-kpi-label">İşlem</span>
                <strong>{filteredSales.length}</strong>
                <em>Net {formatCurrency(salesTotal)}</em>
              </div>
            </article>
            <article className="tx-reports-kpi">
              <span className="tx-reports-kpi-icon" aria-hidden>↩</span>
              <div>
                <span className="tx-reports-kpi-label">İade</span>
                <strong>{filteredReturns.length}</strong>
                <em>{formatCurrency(returnsTotal)}</em>
              </div>
            </article>
            <article className="tx-reports-kpi">
              <span className="tx-reports-kpi-icon" aria-hidden>📊</span>
              <div>
                <span className="tx-reports-kpi-label">Ortalama fiş</span>
                <strong>{formatCurrency(avgTicket)}</strong>
                <em>Brüt {formatCurrency(grossSalesTotal)}</em>
              </div>
            </article>
            <article className="tx-reports-kpi tx-reports-kpi--mix">
              <span className="tx-reports-kpi-label">Ödeme dağılımı</span>
              <div className="tx-reports-mix-row">
                {(['cash', 'card', 'transfer', 'credit'] as const).map((key) => (
                  <span key={key} className="tx-reports-mix-pill" title={PAYMENT_LABELS[key]}>
                    {key === 'cash' ? 'Nakit' : key === 'card' ? 'Kart' : key === 'transfer' ? 'Havale' : 'Veresiye'}
                    <strong>{salesTotal > 0 ? Math.round((paymentMix[key] / salesTotal) * 100) : 0}%</strong>
                  </span>
                ))}
              </div>
            </article>
          </div>
          {tab !== 'purchases' && (
            <div className="tx-reports-toolbar">
              <div className="tx-reports-search">
                <span className="search-icon" aria-hidden>🔍</span>
                <input
                  type="search"
                  placeholder={
                    tab === 'returns'
                      ? (isCashier ? 'İade no, fiş, kasiyer...' : 'İade no, fiş, müşteri, kasiyer...')
                      : (isCashier ? 'Fiş, kasiyer...' : 'Fiş, müşteri, GL no, kasiyer...')
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="tx-reports-method-tabs" role="group" aria-label="Ödeme yöntemi">
                {(['all', 'cash', 'card', 'transfer'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={method === m ? 'active' : ''}
                    onClick={() => setMethod(m)}
                  >
                    {m === 'all' ? 'Tümü' : PAYMENT_LABELS[m].replace(/^.\s*/, '')}
                  </button>
                ))}
              </div>
              <p className="tx-reports-toolbar-summary">
                {tab === 'returns'
                  ? `${filteredReturns.length} iade · ${formatCurrency(returnsTotal)}`
                  : `${filteredSales.length} satış · net ${formatCurrency(salesTotal)}`}
              </p>
            </div>
          )}
        </section>
      ) : embedded ? (
        <div className="transactions-embedded-head">
          <p className="transactions-embedded-lead">
            {isCashier
              ? 'Son 3 günlük satış ve iade kayıtları'
              : 'Satış fişleri, iadeler ve mal alış faturaları'}
          </p>
          <div className="module-tabs transactions-tabs">
            <button type="button" className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}>
              Satış İşlemleri
            </button>
            <button type="button" className={tab === 'returns' ? 'active' : ''} onClick={() => setTab('returns')}>
              İadeler
            </button>
            {!isCashier && (
              <button type="button" className={tab === 'purchases' ? 'active' : ''} onClick={() => setTab('purchases')}>
                Alış Faturaları
              </button>
            )}
          </div>
        </div>
      ) : (
        <header className="module-header">
          <div>
            <h1>İşlemler</h1>
            <p>
              {isCashier
                ? 'Son 3 günlük satış ve iade kayıtları'
                : 'Satış fişleri, iadeler ve mal alış faturaları'}
            </p>
          </div>
          <div className="module-tabs transactions-tabs">
            <button type="button" className={tab === 'sales' ? 'active' : ''} onClick={() => setTab('sales')}>
              Satış İşlemleri
            </button>
            <button type="button" className={tab === 'returns' ? 'active' : ''} onClick={() => setTab('returns')}>
              İadeler
            </button>
            {!isCashier && (
              <button type="button" className={tab === 'purchases' ? 'active' : ''} onClick={() => setTab('purchases')}>
                Alış Faturaları
              </button>
            )}
          </div>
        </header>
      )}

      {isCashier && (
        <p className="cashier-privacy-notice" role="note">{CASHIER_PRIVACY_NOTICE}</p>
      )}

      {tab === 'purchases' && !isCashier ? (
        <PurchaseInvoicesPanel store={store} />
      ) : (
        <>
          {!premiumHead && (
            <div className="module-toolbar transactions-toolbar">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="search"
                  placeholder={
                    tab === 'returns'
                      ? (isCashier ? 'İade no, fiş, GL no, kasiyer...' : 'İade no, fiş, müşteri, kasiyer...')
                      : (isCashier ? 'Fiş, GL no, kasiyer...' : 'Fiş, müşteri, GL no, kasiyer...')
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="module-tabs">
                {(['all', 'cash', 'card', 'transfer'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={method === m ? 'active' : ''}
                    onClick={() => setMethod(m)}
                  >
                    {m === 'all' ? 'Tümü' : PAYMENT_LABELS[m]}
                  </button>
                ))}
              </div>
              <p className="transactions-summary">
                {tab === 'returns'
                  ? `${filteredReturns.length} iade · toplam ${formatCurrency(returnsTotal)}`
                  : `${filteredSales.length} işlem · net ${formatCurrency(salesTotal)}`}
              </p>
            </div>
          )}

          {tab === 'returns' ? (
            <div className={`module-card module-card--flush ${premiumHead ? 'tx-reports-table-card' : ''}`}>
              <table className={`module-table module-table--wide ${premiumHead ? 'tx-reports-table' : ''}`}>
                <thead>
                  <tr>
                    <th>İade No</th>
                    <th>Tarih</th>
                    <th>Fiş No</th>
                    <th>İade Kasiyeri</th>
                    <th>Ödeme</th>
                    <th>Neden</th>
                    <th>Toplam</th>
                    <th>Detay</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map((entry) => (
                    <tr key={entry.id}>
                      <td className="mono">{entry.id}</td>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td className="mono">{entry.originalSaleId}</td>
                      <td>{entry.cashierName ?? '—'}</td>
                      <td>{PAYMENT_LABELS[entry.refundMethod]}</td>
                      <td>{entry.reason ?? '—'}</td>
                      <td><strong className="sale-return-amount">-{formatCurrency(entry.refundTotal)}</strong></td>
                      <td>
                        <details className="sale-details">
                          <summary>Ürünler</summary>
                          <ul>
                            {entry.items.map((item) => {
                              const name = item.setId
                                ? store.productSets.find((set) => set.id === item.setId)?.name ?? `Set ${item.setId}`
                                : store.products.find((p) => p.id === item.productId)?.name ?? `#${item.productId}`;
                              return (
                                <li key={`${entry.id}-${item.lineKey}`}>
                                  {name} × {item.quantity}
                                  {item.priceType === 'sample' ? ' · Numune' : ` — ${formatCurrency(item.unitPrice * item.quantity)}`}
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredReturns.length === 0 && <p className="module-empty">İade kaydı bulunamadı</p>}
            </div>
          ) : (
            <div className={`module-card module-card--flush ${premiumHead ? 'tx-reports-table-card' : ''}`}>
              <table className={`module-table module-table--wide ${premiumHead ? 'tx-reports-table' : ''}`}>
                <thead>
                  <tr>
                    <th>Fiş No</th>
                    <th>Tarih</th>
                    <th>Müşteri</th>
                    <th>Greenleaf</th>
                    <th>Satış Kasiyeri</th>
                    <th>Durum</th>
                    <th>Ödeme</th>
                    <th>Kalem</th>
                    <th>Toplam</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map((sale) => {
                    const status = getSaleStatus(sale, store.saleReturns);
                    const netTotal = getSaleNetTotal(sale, store.saleReturns);
                    const returnable = canReturnSale(sale, store.saleReturns, { cashierMode: isCashier });
                    return (
                      <tr key={sale.id}>
                        <td className="mono">{sale.id}</td>
                        <td>{formatDateTime(sale.createdAt)}</td>
                        <td>{resolveCustomerLabel(sale)}</td>
                        <td className="mono">{sale.greenleafNumber ?? '—'}</td>
                        <td>{sale.cashierName ?? '—'}</td>
                        <td>
                          <span className={`sale-status-badge sale-status-badge--${status}`}>
                            {STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td>{PAYMENT_LABELS[sale.paymentMethod]}</td>
                        <td>{sale.items.reduce((s, i) => s + i.quantity, 0)} adet</td>
                        <td>
                          <strong>{formatCurrency(netTotal)}</strong>
                          {netTotal < sale.total && (
                            <span className="sale-net-hint"> / {formatCurrency(sale.total)}</span>
                          )}
                        </td>
                        <td>
                          <div className="sale-row-actions">
                            <details className="sale-details">
                              <summary>Ürünler</summary>
                              <ul>
                                {sale.items.map((item) => (
                                  <li key={`${sale.id}-${item.productId ?? item.setId}-${item.priceType}`}>
                                    {resolveLineName(item)} × {item.quantity}
                                    {item.priceType === 'sample'
                                      ? ' · Numune'
                                      : ` — ${formatCurrency(item.unitPrice * item.quantity)}`}
                                  </li>
                                ))}
                              </ul>
                            </details>
                            {returnable && (
                              <button
                                type="button"
                                className="btn btn-outline btn-sm sale-return-btn"
                                onClick={() => setReturnSale(sale)}
                              >
                                İade Al
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredSales.length === 0 && <p className="module-empty">İşlem bulunamadı</p>}
            </div>
          )}
        </>
      )}

      <SaleReturnModal
        open={returnSale != null}
        sale={returnSale}
        saleReturns={store.saleReturns}
        products={store.products}
        productSets={store.productSets}
        cashierMode={isCashier}
        onClose={() => setReturnSale(null)}
        onConfirm={async (saleId, lines, refundMethod, reason, note) => {
          const result = store.processSaleReturn(saleId, lines, refundMethod, reason, note);
          if (!result.ok || !result.returnRecord) return result;

          const sale = store.sales.find((entry) => entry.id === saleId);
          if (sale) {
            const printResult = await printSaleReturnReceipt({
              businessName: store.settings.businessName,
              sale,
              returnRecord: result.returnRecord,
              products: store.products,
              productSets: store.productSets,
            });
            showToast(formatReturnReceiptToastMessage(result.returnRecord.id, printResult));
          } else {
            showToast(`İade tamamlandı — ${result.returnRecord.id}`);
          }

          setReturnSale(null);
          return result;
        }}
      />
    </div>
  );
}
