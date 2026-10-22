import { useMemo, useState } from 'react';
import type { Store } from '../../store/useStore';
import type { Product } from '../../types/product';
import {
  stockCountReportDiscrepancies,
  stockCountReportPendingApply,
} from '../../types/stockCountReport';
import { formatDateTime } from '../../utils/format';
import { formatStockCountReportDateTime } from '../../utils/stockCountReportFormat';
import {
  buildPlainTextStockCountReceipt,
  printStockCountReceiptReport,
} from '../../utils/stockCountReceiptReport';
import { STANDARD_WINDOWS_ZYWELL_PRINTER_NAME } from '../../types/receiptPrinter';
import { ProductImage } from '../ProductImage';
import './StockCountReportsPanel.css';

interface StockCountReportsPanelProps {
  store: Store;
}

export function StockCountReportsPanel({ store }: StockCountReportsPanelProps) {
  const reports = useMemo(
    () => [...store.stockCountReports].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    [store.stockCountReports],
  );

  const [selectedId, setSelectedId] = useState<string | null>(reports[0]?.id ?? null);
  const [printMessage, setPrintMessage] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  const selected = reports.find((r) => r.id === selectedId) ?? reports[0];
  const businessName = store.settings.businessName?.trim() || 'Mağaza';
  const printerName =
    store.settings.receiptPrinter?.windowsPrinterName?.trim() || STANDARD_WINDOWS_ZYWELL_PRINTER_NAME;

  const productById = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of store.products) map.set(p.id, p);
    return map;
  }, [store.products]);

  const plainPreview = useMemo(() => {
    if (!selected) return '';
    return buildPlainTextStockCountReceipt({
      businessName,
      report: selected,
      products: store.products,
      printedAt: new Date(selected.printedAt ?? selected.createdAt),
    });
  }, [businessName, selected, store.products]);

  const handlePrint = async () => {
    if (!selected) return;
    setPrinting(true);
    setPrintMessage(null);
    try {
      const printedAt = new Date();
      const result = await printStockCountReceiptReport({
        businessName,
        report: selected,
        products: store.products,
        printedAt,
      }, printerName);
      if (result.printed) {
        store.markStockCountReportPrinted(selected.id);
      }
      setPrintMessage(result.message ?? (result.printed ? 'Yazdırıldı' : 'Yazdırılamadı'));
    } finally {
      setPrinting(false);
    }
  };

  if (reports.length === 0) {
    return (
      <div className="stock-count-reports">
        <p className="module-hint">
          Barkod sayımı bittiğinde oluşturulan raporlar burada listelenir. Önce fiş yazıcısından raporu yazdırın,
          ardından stok işlemlerinden ürün bazında düzeltme uygulayın.
        </p>
        <p className="stock-count-reports-empty">Henüz arşivlenmiş sayım raporu yok.</p>
      </div>
    );
  }

  const discrepancies = selected ? stockCountReportDiscrepancies(selected) : [];
  const pending = selected ? stockCountReportPendingApply(selected) : [];

  return (
    <div className="stock-count-reports">
      <p className="module-hint">
        Sayım oturumu bitince kaydedilen raporlar. Fiş yazıcısından tekrar basabilir; düzeltme durumunu satır satır takip edebilirsiniz.
      </p>

      <div className="stock-count-reports-layout">
        <aside className="stock-count-reports-list">
          {reports.map((report) => {
            const diffCount = stockCountReportDiscrepancies(report).length;
            const pendingCount = stockCountReportPendingApply(report).length;
            const statusLabel = report.abandonedAt
              ? 'Yarım bırakıldı'
              : pendingCount === 0 && diffCount > 0
                ? 'Düzeltildi'
                : !report.printedAt
                  ? 'Yazdırılmadı'
                  : pendingCount > 0
                    ? 'Düzeltme bekliyor'
                    : diffCount === 0
                      ? 'Uyumlu'
                      : 'Tamamlandı';
            return (
              <button
                key={report.id}
                type="button"
                className={`stock-count-reports-list-item ${selected?.id === report.id ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedId(report.id);
                  setPrintMessage(null);
                }}
              >
                <strong>{formatDateTime(report.createdAt)}</strong>
                <span>{report.lines.length} kalem · {diffCount} fark</span>
                <span className="stock-count-reports-list-status">{statusLabel}</span>
              </button>
            );
          })}
        </aside>

        {selected && (
          <div className="stock-count-reports-detail">
            <header className="stock-count-reports-detail-head">
              <div>
                <h3>Sayım raporu</h3>
                <p>
                  Sayım yapan: <strong>{selected.countedByDisplayName?.trim() || '—'}</strong>
                </p>
                <p>
                  Başlangıç {formatStockCountReportDateTime(selected.startedAt)}
                  {selected.endedAt ? ` · Bitiş ${formatStockCountReportDateTime(selected.endedAt)}` : ''}
                  {selected.printedAt ? ` · Yazdırıldı ${formatDateTime(selected.printedAt)}` : ' · Henüz yazdırılmadı'}
                </p>
                {(selected.breaks?.length ?? 0) > 0 && (
                  <ul className="stock-count-reports-breaks">
                    {selected.breaks!.map((entry, index) => (
                      <li key={`${entry.pausedAt}-${index}`}>
                        Ara {index + 1}: {formatStockCountReportDateTime(entry.pausedAt)}
                        {entry.resumedAt ? ` → ${formatStockCountReportDateTime(entry.resumedAt)}` : ' → (devam kaydı yok)'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={printing}
                onClick={() => void handlePrint()}
              >
                {printing ? 'Yazdırılıyor…' : 'Fiş yazdır'}
              </button>
            </header>

            {printMessage && <p className="stock-count-reports-print-msg" role="status">{printMessage}</p>}

            {selected.note.trim() && (
              <p className="stock-count-reports-note"><strong>Not:</strong> {selected.note.trim()}</p>
            )}

            <div className="stock-count-reports-table-wrap">
              <table className="stock-count-reports-table">
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Sistem</th>
                    <th>Sayım</th>
                    <th>Fark</th>
                    <th>Düzeltme</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((line) => {
                    const product = productById.get(line.productId);
                    if (!product) return null;
                    const correctionLabel = line.diff === 0
                      ? '—'
                      : line.appliedAt
                        ? `Uygulandı ${formatDateTime(line.appliedAt)}`
                        : 'Bekliyor';
                    return (
                      <tr key={line.productId} className={line.diff !== 0 ? 'has-diff' : ''}>
                        <td>
                          <div className="stock-count-reports-product">
                            <ProductImage product={product} size="sm" />
                            <div>
                              <span className="stock-count-reports-product-name">{product.name}</span>
                              <span className="stock-count-reports-product-code">
                                {product.productCode ?? product.id}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td>{line.systemStock}</td>
                        <td><strong>{line.scannedQty}</strong></td>
                        <td className={line.diff > 0 ? 'is-up' : line.diff < 0 ? 'is-down' : ''}>
                          {line.diff > 0 ? `+${line.diff}` : line.diff}
                        </td>
                        <td>{correctionLabel}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {discrepancies.length > 0 && pending.length > 0 && (
              <p className="stock-count-reports-pending-hint">
                {pending.length} ürün için düzeltme bekliyor — Stok → Sayım oturumundan veya sayım düzeltme akışından uygulayın.
              </p>
            )}

            <details className="stock-count-reports-preview">
              <summary>Fiş önizleme (metin)</summary>
              <pre>{plainPreview}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
