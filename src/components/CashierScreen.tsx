import { useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import { getBusinessDateKey, getPreviousBusinessDateKey } from '../utils/businessDate';
import {
  filterByBusinessDate,
  formatBusinessDateLabel,
  formatBusinessDateShort,
  getClosedCashSessions,
  getCashSessionForDate,
} from '../utils/cashSession';
import {
  attachRunningBalances,
  buildCashActivityFeed,
  buildCashRegisterSummary,
  CASH_ACTIVITY_KIND_LABELS,
  type CashActivityKind,
  type CashActivityRow,
  formatDeltaPercent,
} from '../utils/cashRegister';
import { sumCashVirmanForDate } from '../utils/cashRegisterTransfers';
import {
  buildCashRegisterReceiptData,
  printCashRegisterReceipt,
} from '../utils/cashRegisterReceiptPrint';
import { formatCurrency, formatDateTime } from '../utils/format';
import './CashierScreen.css';

interface CashierScreenProps {
  store: Store;
  /** Muhasebe alt sekmesi olarak gösterildiğinde üst başlık sadeleştirilir */
  embedded?: boolean;
}

type ActivityFilter = 'all' | 'virman' | CashActivityKind;

const PAYMENT_ROWS = [
  { key: 'cash' as const, label: 'Nakit', icon: '💵', color: '#51b848' },
  { key: 'card' as const, label: 'Kart', icon: '💳', color: '#2563eb' },
  { key: 'transfer' as const, label: 'Havale', icon: '🏦', color: '#8b5cf6' },
];

export function CashierScreen({ store, embedded = false }: CashierScreenProps) {
  const [showDailyCash, setShowDailyCash] = useState(true);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [historyDate, setHistoryDate] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [handoverAmount, setHandoverAmount] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [countAmount, setCountAmount] = useState('');
  const [countNote, setCountNote] = useState('');
  const [entryError, setEntryError] = useState<string | null>(null);
  const [handoverError, setHandoverError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [printBusy, setPrintBusy] = useState(false);

  const calendarDateKey = getBusinessDateKey();
  const activeDateKey = store.activeBusinessDate;
  const isDayClosed = Boolean(store.activeCashSession?.closedAt);
  const isViewingHistory = historyDate !== null;
  const viewDateKey = historyDate ?? activeDateKey;
  const viewSession = getCashSessionForDate(store.cashSessions, viewDateKey);
  const previousClosedSession = getCashSessionForDate(
    store.cashSessions,
    getPreviousBusinessDateKey(activeDateKey),
  );
  const isNextDayActive = activeDateKey > calendarDateKey;

  const closedSessions = useMemo(
    () => getClosedCashSessions(store.cashSessions),
    [store.cashSessions],
  );

  const viewDayData = useMemo(() => ({
    sales: filterByBusinessDate(store.sales, viewDateKey),
    returns: filterByBusinessDate(store.saleReturns, viewDateKey),
    expenses: filterByBusinessDate(store.expenses, viewDateKey),
    handovers: filterByBusinessDate(store.cashHandovers, viewDateKey),
    openingBalance: viewSession?.openingBalance ?? 0,
  }), [store.sales, store.saleReturns, store.expenses, store.cashHandovers, viewDateKey, viewSession]);

  const viewDayVirman = useMemo(
    () => sumCashVirmanForDate(store.journalVouchers, viewDateKey),
    [store.journalVouchers, viewDateKey],
  );

  const summary = useMemo(
    () => buildCashRegisterSummary(
      isViewingHistory ? viewDayData.sales : store.todaySales,
      isViewingHistory ? viewDayData.returns : store.todayReturns,
      isViewingHistory ? viewDayData.expenses : store.todayExpenses,
      isViewingHistory ? viewDayData.handovers : store.todayHandovers,
      isViewingHistory ? viewDayData.openingBalance : store.todayOpeningBalance,
      viewDayVirman,
    ),
    [
      isViewingHistory,
      viewDayData,
      viewDayVirman,
      store.todaySales,
      store.todayReturns,
      store.todayExpenses,
      store.todayHandovers,
      store.todayOpeningBalance,
    ],
  );

  const activity = useMemo(() => {
    if (!isViewingHistory && isDayClosed) return [];

    const feed = buildCashActivityFeed(
      viewDayData.sales,
      viewDayData.returns,
      viewDayData.expenses,
      viewDayData.handovers,
      isViewingHistory ? viewDayData.openingBalance : summary.openingBalance,
      viewDateKey,
      0,
      store.settings.customExpenseCategories ?? [],
      store.journalVouchers,
    );
    return feed;
  }, [
    isViewingHistory,
    isDayClosed,
    viewDayData,
    summary.openingBalance,
    viewDateKey,
    store.settings.customExpenseCategories,
    store.journalVouchers,
  ]);

  const activityRows = useMemo(
    () => attachRunningBalances(activity),
    [activity],
  );

  const filteredActivityRows = useMemo(() => {
    if (activityFilter === 'all') return activityRows;
    if (activityFilter === 'virman') {
      return activityRows.filter((item) => item.kind === 'cash_to_bank' || item.kind === 'bank_to_cash');
    }
    return activityRows.filter((item) => item.kind === activityFilter);
  }, [activityRows, activityFilter]);

  const weekDailyAvg = store.weekTotal / 7;
  const revenueDelta = formatDeltaPercent(summary.netRevenue, weekDailyAvg);

  const paymentRows = PAYMENT_ROWS.map((row) => {
    const value = summary.payment[row.key];
    const absTotal = Math.abs(summary.payment.cash) + Math.abs(summary.payment.card) + Math.abs(summary.payment.transfer);
    const pct = absTotal > 0 ? Math.round((Math.abs(value) / absTotal) * 100) : 0;
    return { ...row, value, pct };
  });

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveEntry = () => {
    setEntryError(null);
    const value = parseFloat(amount.replace(',', '.'));
    if (!desc.trim()) {
      setEntryError('Açıklama girin');
      return;
    }
    if (Number.isNaN(value) || value <= 0) {
      setEntryError('Geçerli bir tutar girin');
      return;
    }

    store.addExpense(desc.trim(), value, 'other');
    showToast('Gider kaydedildi');

    setDesc('');
    setAmount('');
  };

  const buildReceiptSummary = (overrides?: Partial<typeof summary>) => ({
    saleCount: overrides?.saleCount ?? summary.saleCount,
    returnCount: overrides?.returnCount ?? summary.returnCount,
    expenseCount: overrides?.expenseCount ?? summary.expenseCount,
    handoverCount: overrides?.handoverCount ?? summary.handoverCount,
  });

  const handleSaveCashCount = () => {
    const value = parseFloat(countAmount.replace(',', '.'));
    if (Number.isNaN(value)) {
      showToast('Geçerli sayım tutarı girin');
      return;
    }
    const result = store.recordCashDrawerCount(value, countNote.trim() || undefined);
    showToast(
      `Kasa sayımı kaydedildi · Sistem ${formatCurrency(result.expected)} · Fark ${formatCurrency(result.difference)}`,
    );
    setCountAmount('');
    setCountNote('');
  };

  const handleSaveHandover = async () => {
    if (printBusy) return;
    setHandoverError(null);
    const value = parseFloat(handoverAmount.replace(',', '.'));
    if (Number.isNaN(value) || value <= 0) {
      setHandoverError('Geçerli bir tutar girin');
      return;
    }

    const result = store.addCashHandover(value, handoverNote);
    if (!result.ok) {
      setHandoverError(result.error);
      return;
    }

    setPrintBusy(true);
    try {
      const handovers = [...viewDayData.handovers, result.handover!];
      const feed = buildCashActivityFeed(
        viewDayData.sales,
        viewDayData.returns,
        viewDayData.expenses,
        handovers,
        summary.openingBalance,
        activeDateKey,
        0,
        store.settings.customExpenseCategories ?? [],
        store.journalVouchers,
      );
      const rows = attachRunningBalances(feed);
      const closingBalance = rows.length > 0
        ? [...rows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].runningBalance
        : summary.openingBalance - result.handover!.amount;

      const printResult = await printCashRegisterReceipt(
        buildCashRegisterReceiptData({
          reportType: 'handover',
          businessName: store.settings.businessName,
          businessDateKey: activeDateKey,
          openingBalance: summary.openingBalance,
          closingBalance,
          rows,
          summary: buildReceiptSummary({ handoverCount: summary.handoverCount + 1 }),
          cashierName: store.authSession?.displayName,
          handover: result.handover,
        }),
      );

      if (!printResult.printed) {
        showToast(printResult.message ?? 'Devir kaydedildi — fiş yazdırılamadı');
      } else {
        showToast(`Yönetime devir kaydedildi — ${printResult.message ?? 'fiş yazdırıldı'}`);
      }
    } catch {
      showToast('Devir kaydedildi — fiş yazdırılamadı');
    } finally {
      setPrintBusy(false);
    }

    setHandoverAmount('');
    setHandoverNote('');
  };

  const handleCloseDay = async () => {
    if (printBusy) return;

    setPrintBusy(true);
    try {
      const printResult = await printCashRegisterReceipt(
        buildCashRegisterReceiptData({
          reportType: 'day_close',
          businessName: store.settings.businessName,
          businessDateKey: activeDateKey,
          openingBalance: summary.openingBalance,
          closingBalance: summary.closingBalance,
          rows: activityRows,
          summary: buildReceiptSummary(),
          cashierName: store.authSession?.displayName,
        }),
      );

      if (!printResult.printed) {
        showToast(printResult.message ?? 'Fiş yazdırılamadı — gün kapatılmadı');
        return;
      }

      const result = store.closeCashDay();
      if (!result.ok) {
        showToast(result.error ?? 'Gün zaten kapatıldı');
        return;
      }

      showToast(`Gün kapatıldı — ertesi gün açılış: ${formatCurrency(result.closingBalance)} · Fiş yazdırıldı`);
      setHistoryDate(null);
      setActivityFilter('all');
    } catch {
      showToast('Fiş yazdırılamadı — gün kapatılmadı');
    } finally {
      setPrintBusy(false);
    }
  };

  const handleHistoryChange = (value: string) => {
    setHistoryDate(value || null);
    setActivityFilter('all');
  };

  const renderActivityTable = (
    rows: CashActivityRow[],
    emptyMessage: string,
    options?: { showDelete?: boolean },
  ) => {
    if (rows.length === 0) {
      return (
        <div className="cashier-daily-empty">
          {emptyMessage}
        </div>
      );
    }

    const showDelete = options?.showDelete ?? false;

    return (
      <div className="cashier-daily-table-wrap">
        <table className={`cashier-daily-table ${showDelete ? 'cashier-daily-table--actions' : ''}`}>
          <colgroup>
            <col className="cashier-daily-col-time" />
            <col className="cashier-daily-col-kind" />
            <col className="cashier-daily-col-desc" />
            <col className="cashier-daily-col-pay" />
            <col className="cashier-daily-col-source" />
            <col className="cashier-daily-col-amount" />
            <col className="cashier-daily-col-balance" />
            {showDelete && <col className="cashier-daily-col-action" />}
          </colgroup>
          <thead>
            <tr>
              <th>Saat</th>
              <th>Tür</th>
              <th>Açıklama</th>
              <th>Ödeme</th>
              <th>Kaynak</th>
              <th>Tutar</th>
              <th>Bakiye</th>
              {showDelete && <th aria-label="İşlem" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={`${item.kind}-${item.id}`} className={`cashier-daily-row cashier-daily-row--${item.kind}`}>
                <td className="cashier-daily-cell-time">{formatDateTime(item.createdAt)}</td>
                <td>
                  <span className={`cashier-daily-kind cashier-daily-kind--${item.kind}`}>
                    {item.kind === 'sale'
                      ? '↑'
                      : item.kind === 'return'
                        ? '↩'
                        : item.kind === 'handover'
                          ? '⇢'
                          : item.kind === 'opening'
                            ? '⇄'
                            : item.kind === 'cash_to_bank'
                              ? '⇢'
                              : item.kind === 'bank_to_cash'
                                ? '⇠'
                                : '↓'}
                    {CASH_ACTIVITY_KIND_LABELS[item.kind]}
                  </span>
                </td>
                <td className="cashier-daily-cell-desc">
                  <span className="cashier-daily-desc-line">
                    <strong>{item.label}</strong>
                    {item.sublabel && (
                      <span className="cashier-daily-desc-meta"> · {item.sublabel}</span>
                    )}
                  </span>
                </td>
                <td>{item.paymentLabel}</td>
                <td>
                  <span className={`cashier-daily-source ${item.isManual ? 'is-manual' : 'is-auto'}`}>
                    {item.isManual ? 'Manuel' : 'Otomatik'}
                  </span>
                </td>
                <td className={`cashier-daily-cell-amount ${item.signedAmount >= 0 ? 'is-positive' : 'is-negative'}`}>
                  {item.signedAmount >= 0 ? '+' : ''}{formatCurrency(item.signedAmount)}
                </td>
                <td className={`cashier-daily-cell-balance ${item.runningBalance >= 0 ? 'is-positive' : 'is-negative'}`}>
                  {formatCurrency(item.runningBalance)}
                </td>
                {showDelete && (
                  <td className="cashier-daily-cell-action">
                    {item.expenseId ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => store.removeExpense(item.expenseId!)}
                      >
                        Sil
                      </button>
                    ) : item.handoverId ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => store.removeCashHandover(item.handoverId!)}
                      >
                        Sil
                      </button>
                    ) : null}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderActivityList = () => renderActivityTable(
    activityRows,
    'Bugün henüz kasa hareketi yok',
  );

  const canEditToday = !isDayClosed && !isViewingHistory;
  const emptyActivityMessage = isViewingHistory
    ? 'Bu gün için kasa hareketi bulunamadı.'
    : isDayClosed
      ? 'Gün kapatıldı. Hareketleri görmek için geçmiş günlerden seçin.'
      : 'Bugün henüz kasa hareketi yok. Satış yapıldığında otomatik görünür.';

  const nextDayAlertMessage = `✓ ${formatBusinessDateLabel(activeDateKey)} kasası açık. Önceki gün kapatıldı. Açılış bakiyesi: ${formatCurrency(store.todayOpeningBalance)} Geçmiş hareketler için Geçmiş menüsünü kullanın.`;

  const renderDailyCashPanel = () => (
    <section className="cashier-daily-panel">
      <div className="cashier-daily-list">
        {canEditToday && (
          <div className="cashier-daily-forms">
            <div className="cashier-daily-entry-box">
              <h3>↓ Gider Ekle (Manuel)</h3>

              <div className="cashier-daily-entry-grid">
                <label>
                  Açıklama
                  <input
                    value={desc}
                    onChange={(e) => setDesc(e.target.value)}
                    placeholder="Örn. Market alışverişi, kırtasiye..."
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEntry(); }}
                  />
                </label>
                <label>
                  Tutar (₺)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEntry(); }}
                  />
                </label>
                <button type="button" className="btn btn-primary cashier-daily-save-btn" onClick={handleSaveEntry}>
                  Gideri Kaydet
                </button>
              </div>

              {entryError && <p className="sale-return-error" role="alert">{entryError}</p>}
            </div>

            <div className="cashier-daily-entry-box cashier-daily-entry-box--count">
              <h3>⇄ Kasa sayımı</h3>
              <p className="cashier-daily-hint">
                Sistem nakit: <strong>{formatCurrency(summary.closingBalance)}</strong>
                {viewSession?.cashCount && (
                  <> · Son sayım: {formatCurrency(viewSession.cashCount.countedAmount)} (
                    {formatDateTime(viewSession.cashCount.countedAt)})
                  </>
                )}
              </p>
              <div className="cashier-daily-entry-grid">
                <label>
                  Sayılan nakit (₺)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={countAmount}
                    onChange={(e) => setCountAmount(e.target.value)}
                    placeholder="Kasadaki fiziksel tutar"
                  />
                </label>
                <label>
                  Not
                  <input
                    value={countNote}
                    onChange={(e) => setCountNote(e.target.value)}
                    placeholder="Opsiyonel"
                  />
                </label>
                <button type="button" className="btn btn-outline cashier-daily-save-btn" onClick={handleSaveCashCount}>
                  Sayımı kaydet
                </button>
              </div>
            </div>

            <div className="cashier-daily-entry-box cashier-daily-entry-box--handover">
              <h3>⇢ Yönetime Nakit Devri</h3>

              <div className="cashier-daily-entry-grid cashier-daily-entry-grid--handover">
                <label>
                  Tutar (₺)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={handoverAmount}
                    onChange={(e) => setHandoverAmount(e.target.value)}
                    placeholder="0,00"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveHandover(); }}
                  />
                </label>
                <label>
                  Not
                  <input
                    value={handoverNote}
                    onChange={(e) => setHandoverNote(e.target.value)}
                    placeholder="Opsiyonel"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveHandover(); }}
                  />
                </label>
              <button
                type="button"
                className="btn btn-primary cashier-daily-save-btn"
                onClick={handleSaveHandover}
                disabled={printBusy}
              >
                {printBusy ? '⏳ Fiş...' : 'Devret'}
              </button>
              </div>

              {handoverError && <p className="sale-return-error" role="alert">{handoverError}</p>}
            </div>
          </div>
        )}

        {isDayClosed && !isViewingHistory && (
          <div className="cashier-daily-closed-banner is-warning" role="status">
            <strong>Aktif kasa günü kapalı.</strong>
            <span>Günü kapatma işlemi tamamlanmış görünüyor. Geçmiş kayıtları inceleyebilirsiniz.</span>
          </div>
        )}

        <div className="cashier-daily-list-toolbar">
          <div className="cashier-daily-list-head">
            <div className="cashier-daily-list-title-row">
              <h3>
                {isViewingHistory
                  ? `Kasa Hareketleri — ${formatBusinessDateLabel(viewDateKey)}`
                  : `Aktif Gün — ${formatBusinessDateShort(activeDateKey)}`}
              </h3>
              {isNextDayActive && !isViewingHistory && (
                <div className="cashier-daily-marquee-alert" role="status" aria-live="polite">
                  <div className="cashier-daily-marquee-viewport">
                    <div className="cashier-daily-marquee-track">
                      <span>{nextDayAlertMessage}</span>
                      <span aria-hidden="true">{nextDayAlertMessage}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <span>
              Açılış {formatCurrency(summary.openingBalance)}
              {' · '}{summary.saleCount} satış · {summary.returnCount} iade · {summary.expenseCount} gider
              {' · '}{summary.handoverCount} devir
              {summary.virmanCount > 0 ? ` · ${summary.virmanCount} banka virman` : ''}
              {' · '}Kapanış {formatCurrency(
                isViewingHistory
                  ? (viewSession?.closingBalance ?? summary.closingBalance)
                  : summary.closingBalance,
              )}
            </span>
          </div>

          <div className="cashier-daily-toolbar-actions">
            {closedSessions.length > 0 && (
              <label className="cashier-daily-history-picker">
                <span>Geçmiş</span>
                <select
                  value={historyDate ?? ''}
                  onChange={(e) => handleHistoryChange(e.target.value)}
                  aria-label="Geçmiş kasa günü seçin"
                >
                  <option value="">
                    {formatBusinessDateShort(activeDateKey)} (aktif)
                  </option>
                  {closedSessions.map((session) => (
                    <option key={session.date} value={session.date}>
                      {formatBusinessDateShort(session.date)}
                      {session.closingBalance != null
                        ? ` · Kapanış ${formatCurrency(session.closingBalance)}`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="cashier-daily-filters" role="group" aria-label="Hareket filtresi">
              {([
                ['all', `Tümü (${activity.length})`],
                ['sale', `Satışlar (${summary.saleCount})`],
                ['return', `İadeler (${summary.returnCount})`],
                ['expense', `Giderler (${summary.expenseCount})`],
                ['handover', `Devirler (${summary.handoverCount})`],
                ...(summary.virmanCount > 0
                  ? [['virman', `Banka virman (${summary.virmanCount})`] as const]
                  : []),
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={activityFilter === key ? 'active' : ''}
                  onClick={() => setActivityFilter(key)}
                  disabled={!isViewingHistory && isDayClosed}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {renderActivityTable(
          filteredActivityRows,
          activity.length === 0 ? emptyActivityMessage : 'Bu filtrede hareket bulunamadı.',
          { showDelete: canEditToday },
        )}

        {!isViewingHistory && (
          <div className={`cashier-daily-close-row ${isDayClosed ? 'is-closed' : ''}`}>
            <p>
              Kasada kalan tutar ertesi güne devredilir.
              {isDayClosed
                ? ` Gün kapatıldı — ertesi gün açılış ${formatCurrency(previousClosedSession?.closingBalance ?? summary.closingBalance)}`
                : ` Mevcut kapanış: ${formatCurrency(summary.closingBalance)}`}
            </p>
            <button
              type="button"
              className="btn btn-ghost cashier-daily-close-btn"
              onClick={handleCloseDay}
              disabled={isDayClosed || printBusy}
            >
              {printBusy ? '⏳ Fiş...' : isDayClosed ? '✓ Gün Kapatıldı' : 'Günü Kapat ve Devret'}
            </button>
          </div>
        )}

        {isViewingHistory && viewSession?.closedAt && (
          <div className="cashier-daily-close-row is-closed is-archive">
            <p>
              Arşiv kaydı — kapanış {formatCurrency(viewSession.closingBalance ?? summary.closingBalance)}
              {viewSession.closedBy ? ` · ${viewSession.closedBy}` : ''}
              {viewSession.autoClosed ? ' · Otomatik kapatıldı' : ''}
            </p>
            <button
              type="button"
              className="btn btn-ghost cashier-daily-close-btn"
              onClick={() => handleHistoryChange('')}
            >
              Bugüne Dön
            </button>
          </div>
        )}
      </div>
    </section>
  );

  const renderSummaryPanel = () => (
    <div className="cashier-layout">
      <section className="cashier-card">
        <h2>Ödeme Dağılımı (Net)</h2>
        {paymentRows.map((row) => (
          <div key={row.key} className="cashier-payment-row">
            <div className="cashier-payment-label">
              <span aria-hidden>{row.icon}</span>
              {row.label}
            </div>
            <div className="cashier-payment-bar" aria-hidden>
              <span style={{ width: `${row.pct}%`, background: row.color }} />
            </div>
            <div className="cashier-payment-meta">
              <strong>{formatCurrency(row.value)}</strong>
              {row.pct > 0 ? `${row.pct}%` : '—'}
            </div>
          </div>
        ))}

        <div className="cashier-drawer-grid">
          <div className="cashier-drawer-stat">
            <span>Nakit Net</span>
            <strong>{formatCurrency(summary.payment.cash)}</strong>
          </div>
          <div className="cashier-drawer-stat">
            <span>Kart Net</span>
            <strong>{formatCurrency(summary.payment.card)}</strong>
          </div>
          <div className="cashier-drawer-stat">
            <span>Havale Net</span>
            <strong>{formatCurrency(summary.payment.transfer)}</strong>
          </div>
        </div>

        <div className="cashier-week-compare">
          Haftalık net ciro: <strong>{formatCurrency(store.weekTotal)}</strong>
          {' · '}
          Günlük ortalama: <strong>{formatCurrency(weekDailyAvg)}</strong>
        </div>
      </section>

      <section className="cashier-card">
        <h2>Son Hareketler</h2>
        {renderActivityList()}
      </section>
    </div>
  );

  return (
    <div className={`module-screen cashier-screen--premium ${embedded ? 'cashier-screen--embedded' : ''}`}>
      {toast && <div className="sale-toast" role="status">✓ {toast}</div>}

      <section className="cashier-hero">
        <div className="cashier-hero-top">
          <div className="cashier-hero-main">
            <div className="cashier-hero-heading">
              {!embedded && <h1>Kasa Yönetimi</h1>}
              <div className="cashier-hero-date">
                📅 {formatBusinessDateLabel(activeDateKey)}
                {isNextDayActive && (
                  <span className="cashier-hero-date-note">Ertesi gün kasası</span>
                )}
              </div>
              <div className="cashier-hero-view-tabs" role="tablist" aria-label="Kasa görünümü">
                <button
                  type="button"
                  role="tab"
                  aria-selected={!showDailyCash}
                  className={`cashier-daily-btn ${!showDailyCash ? 'active' : ''}`}
                  onClick={() => setShowDailyCash(false)}
                >
                  📊 Özet Görünüm
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={showDailyCash}
                  className={`cashier-daily-btn ${showDailyCash ? 'active' : ''}`}
                  onClick={() => setShowDailyCash(true)}
                >
                  💰 Günlük Kasa
                </button>
              </div>
            </div>
            {showDailyCash && (
              <h2 className="cashier-hero-subtitle">Günlük Kasa Defteri</h2>
            )}
          </div>

          <div className="cashier-hero-kpis">
            <div className="cashier-hero-kpi cashier-hero-kpi--positive">
              <span>Brüt Satış</span>
              <strong>{formatCurrency(summary.grossSales)}</strong>
              <small>{summary.saleCount} fiş</small>
            </div>
            <div className="cashier-hero-kpi cashier-hero-kpi--negative">
              <span>İade</span>
              <strong>-{formatCurrency(summary.refundTotal)}</strong>
              <small>{summary.returnCount} iade</small>
            </div>
            <div className={`cashier-hero-kpi ${summary.netRevenue >= 0 ? 'cashier-hero-kpi--positive' : 'cashier-hero-kpi--negative'}`}>
              <span>Net Ciro</span>
              <strong>{formatCurrency(summary.netRevenue)}</strong>
              {revenueDelta && <small>{revenueDelta}</small>}
            </div>
            <div className={`cashier-hero-kpi ${summary.expenseTotal > 0 ? 'cashier-hero-kpi--negative' : 'cashier-hero-kpi--neutral'}`}>
              <span>Gider</span>
              <strong>{formatCurrency(summary.expenseTotal)}</strong>
              <small>{summary.expenseCount} kayıt</small>
            </div>
            <div className={`cashier-hero-kpi cashier-hero-kpi--drawer ${summary.cashDrawerEstimate >= 0 ? 'cashier-hero-kpi--positive' : 'cashier-hero-kpi--negative'}`}>
              <span>Nakit Çekmece</span>
              <strong>{formatCurrency(summary.cashDrawerEstimate)}</strong>
              <small>Açılış {formatCurrency(summary.openingBalance)} · Devir {formatCurrency(summary.handoverTotal)}</small>
            </div>
            <div className={`cashier-hero-kpi ${summary.closingBalance >= 0 ? 'cashier-hero-kpi--positive' : 'cashier-hero-kpi--negative'}`}>
              <span>Ertesi Gün</span>
              <strong>{formatCurrency(summary.closingBalance)}</strong>
              <small>Kasada kalacak bakiye</small>
            </div>
          </div>
        </div>
      </section>

      {showDailyCash ? renderDailyCashPanel() : renderSummaryPanel()}
    </div>
  );
}
