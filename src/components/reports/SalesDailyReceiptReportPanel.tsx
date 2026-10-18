import { useMemo, useState } from 'react';
import type { Store } from '../../store/useStore';
import { getBusinessDateKey } from '../../utils/businessDate';
import { filterByBusinessDate, formatBusinessDateLabel } from '../../utils/cashSession';
import { getPaymentBreakdown } from '../../utils/analytics';
import { formatCurrencyTry } from '../../utils/format';
import {
  buildPlainTextDailySalesReceipt,
  printDailySalesReceiptReport,
} from '../../utils/dailySalesReceiptReport';
import { STANDARD_WINDOWS_ZYWELL_PRINTER_NAME } from '../../types/receiptPrinter';
import './SalesDailyReceiptReportPanel.css';

interface SalesDailyReceiptReportPanelProps {
  store: Store;
}

const PAYMENT_LABELS = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  credit: 'Veresiye',
} as const;

export function SalesDailyReceiptReportPanel({ store }: SalesDailyReceiptReportPanelProps) {
  const defaultDate = store.activeBusinessDate || getBusinessDateKey();
  const [dateKey, setDateKey] = useState(defaultDate);
  const [printMessage, setPrintMessage] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const daySales = useMemo(() => {
    const rows = filterByBusinessDate(store.sales, dateKey);
    return [...rows].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [store.sales, dateKey]);

  const dayReturns = useMemo(
    () => filterByBusinessDate(store.saleReturns, dateKey),
    [store.saleReturns, dateKey],
  );

  const breakdown = useMemo(
    () => getPaymentBreakdown(daySales, dayReturns),
    [daySales, dayReturns],
  );

  const grossTotal = useMemo(
    () => daySales.reduce((sum, s) => sum + s.total, 0),
    [daySales],
  );

  const returnTotal = useMemo(
    () => dayReturns.reduce((sum, r) => sum + r.refundTotal, 0),
    [dayReturns],
  );

  const netTotal = grossTotal - returnTotal;

  const businessName = store.settings.businessName?.trim() || 'Mağaza';
  const printerName =
    store.settings.receiptPrinter?.windowsPrinterName?.trim() || STANDARD_WINDOWS_ZYWELL_PRINTER_NAME;

  const plainPreview = useMemo(() => buildPlainTextDailySalesReceipt({
    businessName,
    businessDateKey: dateKey,
    createdAt: new Date(),
    sales: daySales,
    saleReturns: dayReturns,
  }), [businessName, dateKey, daySales, dayReturns]);

  const handlePrint = async () => {
    setPrinting(true);
    setPrintMessage(null);
    try {
      const result = await printDailySalesReceiptReport({
        businessName,
        businessDateKey: dateKey,
        createdAt: new Date(),
        sales: daySales,
        saleReturns: dayReturns,
      }, printerName);
      setPrintMessage(result.message ?? (result.printed ? 'Yazdırıldı' : 'Yazdırılamadı'));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="sales-daily-receipt-report">
      <p className="module-hint">
        Seçilen günün satışları fiş numarası ve tutar olarak listelenir; altta genel toplam ve nakit / kart / havale kırılımı yer alır.
        Termal yazıcı köprüsü (Zywell) varsa önce oradan basılır.
      </p>

      <div className="sales-daily-receipt-toolbar">
        <label className="sales-daily-receipt-date">
          <span>Gün</span>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
          />
        </label>
        <p className="sales-daily-receipt-summary">
          <strong>{formatBusinessDateLabel(dateKey)}</strong>
          {' · '}
          <strong>{daySales.length}</strong> satış
          {' · '}
          Net <strong>{formatCurrencyTry(netTotal)}</strong>
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={printing || daySales.length === 0}
          onClick={() => void handlePrint()}
        >
          {printing ? 'Yazdırılıyor…' : 'Fiş yazıcısına yazdır'}
        </button>
      </div>

      {printMessage && (
        <p className="sales-daily-receipt-print-msg" role="status">{printMessage}</p>
      )}

      <div className="sales-daily-receipt-layout">
        <section className="module-card sales-daily-receipt-preview-card">
          <h2>Önizleme (termal)</h2>
          <pre className="sales-daily-receipt-thermal-preview" aria-label="Termal önizleme">
            {plainPreview}
          </pre>
        </section>

        <section className="module-card sales-daily-receipt-breakdown-card">
          <h2>Ödeme kırılımı</h2>
          <ul className="sales-daily-receipt-breakdown">
            <li><span>Nakit</span><strong>{formatCurrencyTry(breakdown.cash)}</strong></li>
            <li><span>Kart</span><strong>{formatCurrencyTry(breakdown.card)}</strong></li>
            <li><span>Havale</span><strong>{formatCurrencyTry(breakdown.transfer)}</strong></li>
            {breakdown.credit !== 0 && (
              <li><span>Veresiye</span><strong>{formatCurrencyTry(breakdown.credit)}</strong></li>
            )}
          </ul>
          <p className="sales-daily-receipt-totals">
            Satış toplamı: {formatCurrencyTry(grossTotal)}
            {returnTotal > 0 ? ` · İade: −${formatCurrencyTry(returnTotal)}` : ''}
            <br />
            <strong>Genel toplam: {formatCurrencyTry(netTotal)}</strong>
          </p>
        </section>
      </div>

      <section className="module-card sales-daily-receipt-table-card">
        <h2>Satış satırları</h2>
        <div className="sales-daily-receipt-table-wrap">
          <table className="module-table">
            <thead>
              <tr>
                <th>Fiş no</th>
                <th>Ödeme</th>
                <th className="num">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {daySales.length === 0 ? (
                <tr>
                  <td colSpan={3} className="module-empty">Bu gün için satış yok</td>
                </tr>
              ) : (
                daySales.map((sale) => (
                  <tr key={sale.id}>
                    <td><code>{sale.id}</code></td>
                    <td>{PAYMENT_LABELS[sale.paymentMethod as keyof typeof PAYMENT_LABELS] ?? sale.paymentMethod}</td>
                    <td className="num">{formatCurrencyTry(sale.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {daySales.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}><strong>Genel toplam</strong></td>
                  <td className="num"><strong>{formatCurrencyTry(netTotal)}</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
    </div>
  );
}
