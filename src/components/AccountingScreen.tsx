import { useEffect, useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import type { ReportPeriod } from '../utils/analytics';
import { getFullChartOfAccounts } from '../data/chartOfAccounts';
import { buildPartnerCapitalRows, getTotalEquityCapital } from '../utils/equityAnalytics';
import {
  buildPartnerProfitSharePreviewFromReports,
  formatPartnerProfitRangeLabel,
  reportPeriodDateRange,
} from '../utils/partnerProfitShare';
import {
  buildCustomerAging,
  buildCustomerBalanceRows,
  buildCustomerStatement,
  buildSupplierBalanceRows,
  getBankAccountBalance,
} from '../utils/accountingAnalytics';
import { formatCurrency, formatDateTime } from '../utils/format';
import { exportCustomerLedgerCsv, exportSupplierLedgerCsv } from '../utils/reportExport';
import { buildTrialBalance, trialBalancePeriodLabel } from '../utils/trialBalance';
import { AccountingVoucherPanel } from './AccountingVoucherPanel';
import { CashierScreen } from './CashierScreen';
import { CustomersScreen } from './CustomersScreen';
import { SuppliersScreen } from './SuppliersScreen';
import { CustomerReportsPanel } from './CustomerReportsPanel';
import { CashReportsPanel } from './CashReportsPanel';
import { IncomeReportsPanel } from './reports/IncomeReportsPanel';
import { ExpenseReportsPanel } from './reports/ExpenseReportsPanel';
import { StockReportsPanel } from './reports/StockReportsPanel';
import { SupplierReportsPanel } from './reports/SupplierReportsPanel';
import { PartnerReportsPanel } from './reports/PartnerReportsPanel';
import { UserReportsPanel } from './reports/UserReportsPanel';
import { CurrencyReportsPanel } from './reports/CurrencyReportsPanel';
import { SecurityReportsPanel } from './reports/SecurityReportsPanel';
import { SystemActivityReportsPanel } from './reports/SystemActivityReportsPanel';
import { VOUCHER_TYPE_LABELS } from '../types/journalVoucher';
import { resolveUserTabPermissions } from '../utils/userAccess';

export type ReportsSubTab =
  | 'gelir'
  | 'gider'
  | 'stok'
  | 'kasa'
  | 'musteriler'
  | 'tedarikci'
  | 'ortaklar'
  | 'islemler'
  | 'kullanici'
  | 'doviz'
  | 'guvenlik';

const REPORTS_PERIOD_SUBTABS: ReportsSubTab[] = [
  'gelir',
  'gider',
  'stok',
  'kasa',
  'ortaklar',
  'musteriler',
  'tedarikci',
  'doviz',
  'kullanici',
  'guvenlik',
  'islemler',
];

type ReportsMenuItem = { id: ReportsSubTab; label: string; icon: string; adminOnly?: boolean };

interface AccountingScreenProps {
  store: Store;
  initialTab?: Exclude<AccountingTab, 'rapor' | 'islemler'>;
  /** Üst menü Raporlar sekmesi: muhasebe alt sekmeleri gizlenir, sadece rapor menüsü */
  reportsOnly?: boolean;
  initialReportsSubTab?: ReportsSubTab;
  transactionsOnlyMenu?: boolean;
}

type AccountingTab =
  | 'fis'
  | 'kasa'
  | 'islemler'
  | 'musteriler'
  | 'tedarikciler'
  | 'defter'
  | 'rapor'
  | 'diger';

const TABS: { id: AccountingTab; label: string }[] = [
  { id: 'fis', label: 'Fiş Girişi' },
  { id: 'kasa', label: 'Kasa' },
  { id: 'musteriler', label: 'Müşteriler' },
  { id: 'tedarikciler', label: 'Tedarikçiler' },
  { id: 'defter', label: 'Defter & Bakiye' },
  { id: 'diger', label: 'Dönem & Diğer' },
];

const REPORTS_SUBTABS: ReportsMenuItem[] = [
  { id: 'gelir', label: 'Gelir Raporları', icon: '📊' },
  { id: 'gider', label: 'Gider Raporları', icon: '📉' },
  { id: 'stok', label: 'Stok Raporları', icon: '📦' },
  { id: 'kasa', label: 'Kasa Raporları', icon: '💰' },
  { id: 'musteriler', label: 'Müşteri Raporları', icon: '👥' },
  { id: 'tedarikci', label: 'Tedarikçi Raporları', icon: '🏭' },
  { id: 'ortaklar', label: 'Ortaklar Raporları', icon: '🤝' },
  { id: 'doviz', label: 'Döviz Kurları', icon: '💱' },
  { id: 'kullanici', label: 'Kullanıcı Raporları', icon: '👤', adminOnly: true },
  { id: 'guvenlik', label: 'Güvenlik Raporları', icon: '🔒', adminOnly: true },
  { id: 'islemler', label: 'İşlemler', icon: '🧾' },
];

function ReportsTypeMenu({
  active,
  onSelect,
  includeAdminReports,
  transactionsOnly = false,
}: {
  active: ReportsSubTab;
  onSelect: (id: ReportsSubTab) => void;
  includeAdminReports: boolean;
  transactionsOnly?: boolean;
}) {
  const visibleItems = REPORTS_SUBTABS.filter((item) => {
    if (transactionsOnly) return item.id === 'islemler';
    if (item.id === 'islemler') return true;
    if (item.adminOnly && !includeAdminReports) return false;
    return true;
  });

  return (
    <nav className="reports-type-menu" aria-label="Rapor türü">
      {visibleItems.map((item) => (
        <div key={item.id} className="reports-type-menu-group">
          <button
            type="button"
            aria-current={active === item.id ? 'true' : undefined}
            className={active === item.id ? 'active' : ''}
            onClick={() => onSelect(item.id)}
          >
            <span className="reports-type-menu-icon" aria-hidden="true">{item.icon}</span>
            <span className="reports-type-menu-label">{item.label}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}

function resolveDefaultAccountingTab(
  initialTab: AccountingTab | undefined,
  visibleTabs: typeof TABS,
  flags: {
    hasAccounting: boolean;
    hasTransactions: boolean;
    hasCashier: boolean;
    hasCustomers: boolean;
  },
): AccountingTab {
  if (initialTab && initialTab !== 'rapor' && initialTab !== 'islemler'
    && visibleTabs.some((item) => item.id === initialTab)) {
    return initialTab;
  }
  if (!flags.hasAccounting) {
    if (flags.hasCashier) return 'kasa';
    if (flags.hasCustomers) return 'musteriler';
  }
  return visibleTabs[0]?.id ?? 'fis';
}

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: 'today', label: 'Bugün' },
  { id: 'week', label: '7 Gün' },
  { id: 'month', label: '30 Gün' },
  { id: 'all', label: 'Tümü' },
];

const TAB_HERO: Record<AccountingTab, { title: string; subtitle: string }> = {
  fis: {
    title: 'Fiş Girişi',
    subtitle: 'Tahsilat, ödeme, gider ve diğer muhasebe fişlerini kaydedin',
  },
  kasa: {
    title: 'Kasa',
    subtitle: 'Günlük kasa oturumu, nakit hareketleri ve gün sonu işlemleri',
  },
  islemler: {
    title: 'İşlemler',
    subtitle: 'Sistemde en çok kullanılan modüller ve sekme geçişleri',
  },
  musteriler: {
    title: 'Müşteriler',
    subtitle: 'Cari hesaplar, tahsilat ve ekstre',
  },
  tedarikciler: {
    title: 'Tedarikçiler',
    subtitle: 'Tedarikçi cari hesapları, borç bakiyesi ve hareket fişi',
  },
  defter: {
    title: 'Defter & Bakiye',
    subtitle: 'Müşteri/tedarikçi bakiyeleri, banka ve yevmiye defteri',
  },
  rapor: {
    title: 'Raporlar',
    subtitle: 'Gelir, gider, stok, kasa ve sistem kullanım özetleri',
  },
  diger: {
    title: 'Dönem & Diğer',
    subtitle: 'Dönem kapanışı, ortak kartları, hesap planı ve banka tanımları',
  },
};

const PERIOD_TABS: AccountingTab[] = ['defter', 'diger'];

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function AccountingScreen({
  store,
  initialTab,
  reportsOnly = false,
  initialReportsSubTab,
  transactionsOnlyMenu = false,
}: AccountingScreenProps) {
  const tabPerms = resolveUserTabPermissions(
    store.users.find((u) => u.id === store.authSession?.userId),
    store.authSession,
  );
  const hasAccounting = tabPerms.hasFullAccounting;
  const hasTransactions = tabPerms.hasTransactions;
  const hasCashier = tabPerms.hasCashier;
  const hasCustomers = tabPerms.hasCustomers;
  const visibleTabs = TABS.filter((item) => {
    if (item.id === 'fis') return hasAccounting;
    if (item.id === 'kasa') return hasCashier || hasAccounting;
    if (item.id === 'musteriler') return hasCustomers || hasAccounting;
    if (item.id === 'tedarikciler') return hasAccounting;
    return hasAccounting;
  });
  const defaultTab = resolveDefaultAccountingTab(initialTab, visibleTabs, {
    hasAccounting,
    hasTransactions,
    hasCashier,
    hasCustomers,
  });

  const [tab, setTab] = useState<AccountingTab>(reportsOnly ? 'rapor' : defaultTab);
  const activeTab: AccountingTab = reportsOnly ? 'rapor' : tab;
  const [reportsSubTab, setReportsSubTab] = useState<ReportsSubTab>(
    initialReportsSubTab ?? (transactionsOnlyMenu ? 'islemler' : 'gelir'),
  );

  useEffect(() => {
    if (reportsOnly || !initialTab) return;
    if (visibleTabs.some((item) => item.id === initialTab)) {
      setTab(initialTab);
    }
  }, [initialTab, reportsOnly, visibleTabs]);
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const customerRows = useMemo(
    () => buildCustomerBalanceRows(
      store.customers.map((c) => ({ id: c.id, name: c.name })),
      store.customerLedger,
    ),
    [store.customers, store.customerLedger],
  );

  const supplierRows = useMemo(
    () => buildSupplierBalanceRows(store.suppliers, store.supplierLedger),
    [store.suppliers, store.supplierLedger],
  );

  const aging = useMemo(
    () => buildCustomerAging(store.customerLedger),
    [store.customerLedger],
  );

  const customerStatement = useMemo(() => {
    if (!selectedCustomerId) return [];
    return buildCustomerStatement(selectedCustomerId, store.customerLedger);
  }, [selectedCustomerId, store.customerLedger]);

  const partnerCapitalRows = useMemo(
    () => buildPartnerCapitalRows(store.equityPartners, store.capitalContributions),
    [store.equityPartners, store.capitalContributions],
  );

  const periodKey = todayIsoDate().slice(0, 7);
  const hero = TAB_HERO[activeTab];
  const showPeriodFilter = PERIOD_TABS.includes(activeTab)
    && (activeTab !== 'rapor' || REPORTS_PERIOD_SUBTABS.includes(reportsSubTab));

  const heroSubtitle = activeTab === 'rapor' ? '' : hero.subtitle;
  const isAdmin = store.authSession?.role === 'admin';

  return (
    <div className={`module-screen accounting-screen accounting-screen--premium${reportsOnly ? ' accounting-screen--reports-only' : ''}`}>
      <header className="accounting-hero accounting-hero--toolbar">
        <h1 className="accounting-hero-title">{hero.title}</h1>
        {!reportsOnly && (
          <div className="accounting-tabs accounting-hero-tabs" role="tablist" aria-label="Muhasebe sekmeleri">
            {visibleTabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={activeTab === item.id}
                className={activeTab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
        {showPeriodFilter && (
          <div className="reports-period-tabs accounting-hero-period">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={period === p.id ? 'active' : ''}
                onClick={() => setPeriod(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </header>
      {heroSubtitle ? (
        <p className="accounting-hero-subtitle">{heroSubtitle}</p>
      ) : null}

      {!reportsOnly && activeTab === 'fis' && (
        <AccountingVoucherPanel store={store} />
      )}

      {!reportsOnly && activeTab === 'kasa' && (
        <CashierScreen store={store} embedded />
      )}

      {!reportsOnly && activeTab === 'musteriler' && (
        <CustomersScreen store={store} embedded />
      )}

      {!reportsOnly && activeTab === 'tedarikciler' && (
        <SuppliersScreen store={store} embedded />
      )}

      {!reportsOnly && activeTab === 'defter' && (
        <div className="accounting-grid">
          <section className="module-card">
            <div className="accounting-card-head">
              <h2>Müşteri Alacakları</h2>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => exportCustomerLedgerCsv(customerRows)}>
                CSV
              </button>
            </div>
            <table className="module-table">
              <thead>
                <tr><th>Müşteri</th><th>Bakiye</th><th>Vadesi Geçen</th></tr>
              </thead>
              <tbody>
                {customerRows.length === 0 ? (
                  <tr><td colSpan={3} className="module-empty">Alacak kaydı yok</td></tr>
                ) : customerRows.map((row) => (
                  <tr
                    key={row.customerId}
                    className={selectedCustomerId === row.customerId ? 'is-selected' : ''}
                    onClick={() => setSelectedCustomerId(row.customerId)}
                  >
                    <td>{row.customerName}</td>
                    <td className="is-negative">{formatCurrency(row.balance)}</td>
                    <td>{formatCurrency(row.overdueBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="module-card">
            <h2>Yaşlandırma (30/60/90)</h2>
            {aging.map((bucket) => (
              <div key={bucket.label} className="accounting-aging-row">
                <span>{bucket.label}</span>
                <strong>{formatCurrency(bucket.amount)}</strong>
              </div>
            ))}
          </section>

          {selectedCustomerId && (
            <section className="module-card accounting-span-2">
              <h3>Müşteri Ekstresi</h3>
              <table className="module-table">
                <thead>
                  <tr><th>Tarih</th><th>İşlem</th><th>Borç</th><th>Alacak</th><th>Bakiye</th></tr>
                </thead>
                <tbody>
                  {customerStatement.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.date)}</td>
                      <td>{row.type}</td>
                      <td>{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                      <td>{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                      <td>{formatCurrency(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section className="module-card">
            <div className="accounting-card-head">
              <h2>Tedarikçi Borçları</h2>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => exportSupplierLedgerCsv(supplierRows)}>
                CSV
              </button>
            </div>
            <table className="module-table">
              <thead>
                <tr><th>Tedarikçi</th><th>Borç</th><th>Vadesi Geçen</th></tr>
              </thead>
              <tbody>
                {supplierRows.length === 0 ? (
                  <tr><td colSpan={3} className="module-empty">Borç kaydı yok</td></tr>
                ) : supplierRows.map((row) => (
                  <tr key={row.supplierId}>
                    <td>{row.supplierName}</td>
                    <td className="is-negative">{formatCurrency(row.balance)}</td>
                    <td>{formatCurrency(row.overdueBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="module-card">
            <h2>Banka Bakiyeleri</h2>
            <table className="module-table">
              <thead><tr><th>Hesap</th><th>Banka</th><th>Bakiye</th></tr></thead>
              <tbody>
                {store.bankAccounts.length === 0 ? (
                  <tr><td colSpan={3} className="module-empty">Banka hesabı yok — Fiş Girişi → Banka Para Girişi</td></tr>
                ) : store.bankAccounts.map((acc) => (
                  <tr key={acc.id}>
                    <td>{acc.name}</td>
                    <td>{acc.bankName}</td>
                    <td>{formatCurrency(getBankAccountBalance(acc, store.bankTransactions))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="module-card accounting-span-2">
            <h2>Yurtdışı Ortak Sermayesi (500)</h2>
            <p className="module-hint">
              Toplam: {formatCurrency(getTotalEquityCapital(store.capitalContributions))}
            </p>
            <table className="module-table">
              <thead>
                <tr><th>Hesap</th><th>Ortak</th><th>Ülke</th><th>Pay</th><th>Sermaye</th></tr>
              </thead>
              <tbody>
                {partnerCapitalRows.map((row) => (
                  <tr key={row.partnerId}>
                    <td><code>{row.accountCode}</code></td>
                    <td>{row.partnerName}</td>
                    <td>{row.country || '—'}</td>
                    <td>{row.sharePercent > 0 ? `${row.sharePercent}%` : '—'}</td>
                    <td>{formatCurrency(row.totalContributed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="module-card accounting-span-2">
            <h2>Yevmiye Defteri (Son Fişler)</h2>
            <table className="module-table">
              <thead>
                <tr><th>Fiş</th><th>Tarih</th><th>İşlem</th><th>Borç Hesap</th><th>Alacak Hesap</th><th>Tutar</th></tr>
              </thead>
              <tbody>
                {store.journalVouchers.length === 0 ? (
                  <tr><td colSpan={6} className="module-empty">Fiş Girişi sekmesinden kayıt yapın</td></tr>
                ) : store.journalVouchers.slice(0, 25).map((v) => {
                  const debitLine = v.lines.find((l) => l.debit > 0);
                  const creditLine = v.lines.find((l) => l.credit > 0);
                  const isVoided = v.status === 'voided';
                  return (
                    <tr key={v.id} className={isVoided ? 'accounting-voucher-row-voided' : undefined}>
                      <td>{v.voucherNo}{isVoided ? ' (iptal)' : ''}</td>
                      <td>{v.date}</td>
                      <td>{VOUCHER_TYPE_LABELS[v.transactionType]}</td>
                      <td>{debitLine ? `${debitLine.accountCode} ${debitLine.accountName}` : '—'}</td>
                      <td>{creditLine ? `${creditLine.accountCode} ${creditLine.accountName}` : '—'}</td>
                      <td>{formatCurrency(v.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {activeTab === 'rapor' && (
        <section className="module-card accounting-reports-shell">
          <div className="accounting-reports-layout">
            <ReportsTypeMenu
              active={reportsSubTab}
              onSelect={setReportsSubTab}
              includeAdminReports={isAdmin}
              transactionsOnly={transactionsOnlyMenu}
            />
            <div className="accounting-reports-panel">
          {reportsSubTab === 'gelir' && (
            <IncomeReportsPanel store={store} period={period} />
          )}

          {reportsSubTab === 'gider' && (
            <ExpenseReportsPanel store={store} period={period} />
          )}

          {reportsSubTab === 'stok' && (
            <StockReportsPanel store={store} period={period} />
          )}

          {reportsSubTab === 'kasa' && (
            <CashReportsPanel
              store={store}
              period={period}
              useCustomRange={false}
              dateFrom=""
              dateTo=""
            />
          )}

          {reportsSubTab === 'tedarikci' && (
            <SupplierReportsPanel store={store} period={period} />
          )}

          {reportsSubTab === 'ortaklar' && (
            <PartnerReportsPanel store={store} period={period} />
          )}

          {reportsSubTab === 'doviz' && (
            <CurrencyReportsPanel store={store} period={period} />
          )}

          {reportsSubTab === 'kullanici' && isAdmin && (
            <UserReportsPanel store={store} period={period} />
          )}

          {reportsSubTab === 'guvenlik' && isAdmin && (
            <SecurityReportsPanel store={store} period={period} />
          )}

          {reportsSubTab === 'islemler' && (
            <SystemActivityReportsPanel store={store} period={period} />
          )}

          {reportsSubTab === 'musteriler' && (
            <CustomerReportsPanel store={store} period={period} />
          )}
            </div>
          </div>
        </section>
      )}

      {!reportsOnly && activeTab === 'diger' && (
        <OtherOpsTab store={store} period={period} periodKey={periodKey} />
      )}
    </div>
  );
}

function EquityPartnerRow({
  partner,
  store,
}: {
  partner: import('../types/accounting').EquityPartner;
  store: Store;
}) {
  const [name, setName] = useState(partner.name);
  const [country, setCountry] = useState(partner.country);
  const [share, setShare] = useState(String(partner.sharePercent ?? ''));

  const handleSave = () => {
    store.updateEquityPartner(partner.id, {
      name: name.trim() || partner.name,
      country: country.trim(),
      sharePercent: parseFloat(share) || undefined,
    });
  };

  return (
    <tr>
      <td><code>{partner.accountCode}</code></td>
      <td><input className="equity-partner-input" value={name} onChange={(e) => setName(e.target.value)} /></td>
      <td><input className="equity-partner-input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Ülke" /></td>
      <td><input className="equity-partner-input equity-partner-input--narrow" value={share} onChange={(e) => setShare(e.target.value)} /></td>
      <td><button type="button" className="btn btn-sm btn-outline" onClick={handleSave}>Kaydet</button></td>
    </tr>
  );
}

function OtherOpsTab({
  store,
  period,
  periodKey,
}: {
  store: Store;
  period: ReportPeriod;
  periodKey: string;
}) {
  const chartAccounts = useMemo(() => getFullChartOfAccounts(store.equityPartners), [store.equityPartners]);
  const partnerCapitalRows = useMemo(
    () => buildPartnerCapitalRows(store.equityPartners, store.capitalContributions),
    [store.equityPartners, store.capitalContributions],
  );

  const [zeroShareOnLoss, setZeroShareOnLoss] = useState(true);

  const partnerProfitPreview = useMemo(
    () => buildPartnerProfitSharePreviewFromReports(
      store.equityPartners,
      period,
      store.sales,
      store.saleReturns,
      store.expenses,
      store.products,
      store.stockAdjustments,
      { zeroShareOnLoss },
    ),
    [
      store.equityPartners,
      store.sales,
      store.saleReturns,
      store.expenses,
      store.products,
      store.stockAdjustments,
      zeroShareOnLoss,
      period,
    ],
  );

  const partnerPeriodRangeLabel = useMemo(() => {
    if (period === 'all') return 'Tüm kayıtlar';
    const range = reportPeriodDateRange(period);
    return formatPartnerProfitRangeLabel(range.from, range.to);
  }, [period]);

  const [bankAccName, setBankAccName] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [adjProductId, setAdjProductId] = useState('');
  const [adjQty, setAdjQty] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [periodSubTab, setPeriodSubTab] = useState<'mizan' | 'ortaklar' | null>(null);
  const [mizanIncludeSubAccounts, setMizanIncludeSubAccounts] = useState(false);

  const trialBalance = useMemo(
    () => buildTrialBalance(store.journalVouchers, period, {
      includeSubAccounts: mizanIncludeSubAccounts,
      chartAccounts,
      bankAccounts: store.bankAccounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        bankName: acc.bankName,
        openingBalance: acc.openingBalance,
      })),
      customers: store.customers.map((c) => ({ id: c.id, name: c.name })),
      suppliers: store.suppliers.map((s) => ({ id: s.id, name: s.name })),
      customerLedger: store.customerLedger,
      supplierLedger: store.supplierLedger,
      bankTransactions: store.bankTransactions,
      capitalContributions: store.capitalContributions,
      equityPartners: store.equityPartners,
      sales: store.sales,
      saleReturns: store.saleReturns,
      products: store.products,
      includeOperationalSales: true,
    }),
    [
      store.journalVouchers,
      store.bankAccounts,
      store.bankTransactions,
      store.customerLedger,
      store.supplierLedger,
      store.customers,
      store.suppliers,
      store.capitalContributions,
      store.equityPartners,
      store.sales,
      store.saleReturns,
      store.products,
      period,
      mizanIncludeSubAccounts,
      chartAccounts,
    ],
  );

  const handleAddBankAccount = () => {
    const balance = parseFloat(openingBalance.replace(',', '.'));
    if (!bankAccName.trim() || !bankName.trim()) return;
    store.addBankAccount({
      name: bankAccName.trim(),
      bankName: bankName.trim(),
      iban: iban.trim() || undefined,
      openingBalance: Number.isNaN(balance) ? 0 : balance,
      isActive: true,
    });
    setBankAccName('');
    setBankName('');
    setIban('');
  };

  const handleStockAdj = () => {
    const pid = parseInt(adjProductId, 10);
    const qty = parseFloat(adjQty.replace(',', '.'));
    if (Number.isNaN(pid) || Number.isNaN(qty) || qty === 0) return;
    const product = store.products.find((p) => p.id === pid);
    if (!product) return;
    store.addStockAdjustment({
      productId: pid,
      type: qty < 0 ? 'waste' : 'count_diff',
      quantityDelta: qty,
      unitCost: product.purchasePrice,
      note: adjNote.trim() || undefined,
    });
    setAdjQty('');
    setAdjNote('');
  };

  const handlePeriodClose = () => {
    store.closeAccountingPeriod(periodKey, period, false, '', '', `${periodKey} dönem kapanışı`);
  };

  return (
    <div className="accounting-grid">
      <section className="module-card accounting-span-2 accounting-period-close-card">
        <h2>Dönem Kapanışı</h2>
        <div className="accounting-period-close-actions">
          <button type="button" className="btn btn-primary" onClick={handlePeriodClose}>
            {periodKey} Dönemini Kapat
          </button>
          <div className="accounting-period-subtabs reports-period-tabs" role="tablist" aria-label="Dönem kapanışı alt sekmeler">
            <button
              type="button"
              role="tab"
              aria-selected={periodSubTab === 'mizan'}
              className={periodSubTab === 'mizan' ? 'active' : ''}
              onClick={() => setPeriodSubTab('mizan')}
            >
              Mizan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={periodSubTab === 'ortaklar'}
              className={periodSubTab === 'ortaklar' ? 'active' : ''}
              onClick={() => setPeriodSubTab('ortaklar')}
            >
              Ortaklar
            </button>
          </div>
        </div>

        {periodSubTab === 'mizan' && (
          <div className="accounting-mizan-panel">
            <div className="accounting-mizan-head">
              <div className="accounting-mizan-head-title">
                <h3>Mizan</h3>
                <label className="accounting-mizan-sub-toggle accounting-checkbox">
                  <input
                    type="checkbox"
                    checked={mizanIncludeSubAccounts}
                    onChange={(e) => setMizanIncludeSubAccounts(e.target.checked)}
                  />
                  Alt kırılımlar
                </label>
              </div>
              {mizanIncludeSubAccounts && (
                <p className="accounting-mizan-sub-hint">
                  Borç/alacak: seçili dönemdeki hareket. Bakiye: güncel cari ve banka bakiyesi (102/120/320). Diğer hesaplar yevmiye fişinden.
                </p>
              )}
              <span className="accounting-mizan-meta">
                {trialBalancePeriodLabel(period)} · {trialBalance.voucherCount} fiş
                {trialBalance.operationalSalesCount > 0 && (
                  <> · {trialBalance.operationalSalesCount} kasa satışı</>
                )}
                {trialBalance.operationalReturnsCount > 0 && (
                  <> · {trialBalance.operationalReturnsCount} iade</>
                )}
                {trialBalance.totalDebit !== trialBalance.totalCredit && (
                  <em className="accounting-mizan-warn"> · Borç/alacak toplamı farklı</em>
                )}
              </span>
              <p className="accounting-mizan-sub-hint accounting-mizan-sources-hint">
                Fişler + kasa satışları (600, 391, 621) ve cari/banka hareketleri. KDV varsayılan %20.
              </p>
            </div>
            {trialBalance.rows.length === 0 ? (
              <p className="module-empty">Seçili dönemde yevmiye fişi yok.</p>
            ) : (
              <div className="accounting-mizan-table-wrap">
                <table className="module-table accounting-mizan-table">
                  <thead>
                    <tr>
                      <th>Hesap</th>
                      <th>Hesap adı</th>
                      <th className="customer-list-col-num">Borç</th>
                      <th className="customer-list-col-num">Alacak</th>
                      <th className="customer-list-col-num" title="Güncel bakiye (borç)">Bakiye (B)</th>
                      <th className="customer-list-col-num" title="Güncel bakiye (alacak)">Bakiye (A)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalance.rows.map((row) => (
                      <tr
                        key={row.rowKey}
                        className={[
                          row.rowKind === 'group' ? 'accounting-mizan-row--group' : '',
                          row.rowKind === 'sub' ? 'accounting-mizan-row--sub' : '',
                        ].filter(Boolean).join(' ') || undefined}
                      >
                        <td><code>{row.accountCode}</code></td>
                        <td>{row.accountName}</td>
                        <td className="customer-list-col-num">{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                        <td className="customer-list-col-num">{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                        <td className="customer-list-col-num">{row.balanceDebit > 0 ? formatCurrency(row.balanceDebit) : '—'}</td>
                        <td className="customer-list-col-num">{row.balanceCredit > 0 ? formatCurrency(row.balanceCredit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="accounting-mizan-total">
                      <td colSpan={2}><strong>Toplam</strong></td>
                      <td className="customer-list-col-num"><strong>{formatCurrency(trialBalance.totalDebit)}</strong></td>
                      <td className="customer-list-col-num"><strong>{formatCurrency(trialBalance.totalCredit)}</strong></td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        {periodSubTab === 'ortaklar' && (
          <div className="accounting-ortaklar-panel">
            <div className="accounting-ortaklar-block accounting-partner-profit">
              <h3>Kar payı önizleme</h3>
              <p className="module-hint">
                Dağıtılabilir kâr: <strong>net satış (KDV hariç, mizan 600 ile uyumlu)</strong> − satılan malın maliyeti (SMM) − giderler.
                Üstteki <strong>{trialBalancePeriodLabel(period)}</strong> filtresi mizan ile aynıdır; kar payı % toplamı %100 olmalıdır.
              </p>
              <p className="accounting-partner-profit-breakdown">
                <span>Net satış: {formatCurrency(partnerProfitPreview.periodBasis.netRevenue)}</span>
                <span>SMM: {formatCurrency(partnerProfitPreview.periodBasis.cogs)}</span>
                <span>Gider: {formatCurrency(partnerProfitPreview.periodBasis.operatingExpenses)}</span>
                <span><strong>Net kâr: {formatCurrency(partnerProfitPreview.periodBasis.netProfit)}</strong></span>
              </p>
              <label className="accounting-checkbox accounting-partner-profit-option">
                <input
                  type="checkbox"
                  checked={zeroShareOnLoss}
                  onChange={(e) => setZeroShareOnLoss(e.target.checked)}
                />
                Net kâr negatifse kar payını 0 göster
              </label>
              <div className="accounting-partner-profit-kpis">
                <div className="accounting-partner-profit-kpi">
                  <span className="accounting-partner-profit-kpi-label">{partnerProfitPreview.periodLabel} net kâr</span>
                  <strong>{formatCurrency(partnerProfitPreview.netProfitMonth)}</strong>
                  <em>{partnerPeriodRangeLabel}</em>
                </div>
                <div className="accounting-partner-profit-kpi">
                  <span className="accounting-partner-profit-kpi-label">Bu yıl net kâr (YTD)</span>
                  <strong>{formatCurrency(partnerProfitPreview.netProfitYear)}</strong>
                  <em>{formatPartnerProfitRangeLabel(partnerProfitPreview.yearRange.from, partnerProfitPreview.yearRange.to)}</em>
                </div>
                <div className="accounting-partner-profit-kpi">
                  <span className="accounting-partner-profit-kpi-label">Toplam kar payı oranı</span>
                  <strong className={partnerProfitPreview.sharePercentComplete ? '' : 'accounting-partner-profit-warn'}>
                    {partnerProfitPreview.totalSharePercent}%
                  </strong>
                  {!partnerProfitPreview.sharePercentComplete && (
                    <em className="accounting-partner-profit-warn">Toplam %100 olmalı</em>
                  )}
                </div>
              </div>
              <table className="module-table accounting-partner-profit-table">
                <thead>
                  <tr>
                    <th>Hesap</th>
                    <th>Ortak</th>
                    <th>Kar payı %</th>
                    <th className="customer-list-col-num">{partnerProfitPreview.periodLabel} pay</th>
                    <th className="customer-list-col-num">Bu yıl pay (YTD)</th>
                    <th className="customer-list-col-num" title="Seçili dönem payının 12 ile çarpımı; taahhüt değil">Senaryo (×12)</th>
                  </tr>
                </thead>
                <tbody>
                  {partnerProfitPreview.rows.map((row) => (
                    <tr key={row.partnerId}>
                      <td><code>{row.accountCode}</code></td>
                      <td>{row.partnerName}{row.country ? ` · ${row.country}` : ''}</td>
                      <td>{row.sharePercent > 0 ? `${row.sharePercent}%` : '—'}</td>
                      <td className="customer-list-col-num">{formatCurrency(row.monthlyShare)}</td>
                      <td className="customer-list-col-num">{formatCurrency(row.yearlyShare)}</td>
                      <td className="customer-list-col-num">{formatCurrency(row.projectedYearlyFromMonth)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="accounting-mizan-total">
                    <td colSpan={3}><strong>Toplam</strong></td>
                    <td className="customer-list-col-num"><strong>{formatCurrency(partnerProfitPreview.monthlyShareTotal)}</strong></td>
                    <td className="customer-list-col-num"><strong>{formatCurrency(partnerProfitPreview.yearlyShareTotal)}</strong></td>
                    <td className="customer-list-col-num"><strong>{formatCurrency(partnerProfitPreview.projectedYearlyFromMonthTotal)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="accounting-ortaklar-block">
              <h3>Yurtdışı Ortak Kartları (500.01 – 500.05)</h3>
              <p className="module-hint">Hesap kodları sabit; ad, ülke ve <strong>kar payı %</strong> alanlarını güncelleyin (toplam %100).</p>
              <table className="module-table equity-partner-table">
                <thead>
                  <tr><th>Hesap</th><th>Ortak Adı</th><th>Ülke</th><th>Kar payı %</th><th></th></tr>
                </thead>
                <tbody>
                  {store.equityPartners.map((partner) => (
                    <EquityPartnerRow key={partner.id} partner={partner} store={store} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="accounting-ortaklar-block voucher-equity-card">
              <h3>Ortak Sermaye Özeti</h3>
              <p className="module-hint">
                Toplam ödenmiş sermaye: <strong>{formatCurrency(getTotalEquityCapital(store.capitalContributions))}</strong>
              </p>
              <table className="module-table">
                <thead>
                  <tr><th>Hesap</th><th>Ortak</th><th>Ülke</th><th>Pay %</th><th>Toplam Sermaye</th><th>Son Giriş</th></tr>
                </thead>
                <tbody>
                  {partnerCapitalRows.map((row) => (
                    <tr key={row.partnerId}>
                      <td><code>{row.accountCode}</code></td>
                      <td>{row.partnerName}</td>
                      <td>{row.country || '—'}</td>
                      <td>{row.sharePercent > 0 ? `${row.sharePercent}%` : '—'}</td>
                      <td>{formatCurrency(row.totalContributed)}</td>
                      <td>{row.lastContributionDate ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {store.periodClosures.length > 0 && (
          <div className="accounting-period-closures">
            <h3 className="accounting-period-closures-title">Son kapanışlar</h3>
            {store.periodClosures.slice(0, 5).map((pc) => (
              <div key={pc.id} className="accounting-aging-row">
                <span>{pc.periodKey} · {formatDateTime(pc.closedAt)}</span>
                <strong>{formatCurrency(pc.snapshot.netProfit)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>

      {periodSubTab !== 'ortaklar' && (
      <>
      <section className="module-card">
        <h2>Banka Hesabı Tanımı</h2>
        <p className="module-hint">Banka işlemleri için önce hesap tanımlayın; hareketler Fiş Girişi sekmesinden yapılır.</p>
        <div className="accounting-form-grid">
          <label>Hesap Adı<input value={bankAccName} onChange={(e) => setBankAccName(e.target.value)} /></label>
          <label>Banka<input value={bankName} onChange={(e) => setBankName(e.target.value)} /></label>
          <label>IBAN<input value={iban} onChange={(e) => setIban(e.target.value)} /></label>
          <label>Açılış Bakiye<input value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} /></label>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleAddBankAccount}>Banka Hesabı Ekle</button>
      </section>

      <section className="module-card">
        <h2>Stok Düzeltme / Fire</h2>
        <div className="accounting-form-grid">
          <label>
            Ürün
            <select value={adjProductId} onChange={(e) => setAdjProductId(e.target.value)}>
              <option value="">Seçin</option>
              {store.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Miktar (+/-)<input value={adjQty} onChange={(e) => setAdjQty(e.target.value)} placeholder="-2" /></label>
          <label>Not<input value={adjNote} onChange={(e) => setAdjNote(e.target.value)} /></label>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleStockAdj}>Düzeltme Kaydet</button>
      </section>

      <section className="module-card voucher-coa-card accounting-span-2">
        <h2>Hesap Planı</h2>
        <p className="module-hint">Tek Düzen Hesap Planı — 500 serisi ortak sermaye hesapları dahil</p>
        <div className="voucher-coa-grid">
          {chartAccounts.map((acc) => (
            <div key={acc.code} className={`voucher-coa-item voucher-coa-item--${acc.type}`}>
              <code>{acc.code}</code>
              <span>{acc.name}</span>
            </div>
          ))}
        </div>
      </section>
      </>
      )}
    </div>
  );
}
