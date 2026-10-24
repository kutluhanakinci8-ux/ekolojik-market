import { useMemo, useState } from 'react';
import type { Store } from '../../store/useStore';
import { formatCurrencyTry } from '../../utils/format';
import {
  buildProfitMarginReportRows,
  formatMarginPercent,
} from '../../utils/profitMarginReport';
import { openProfitMarginReportPrint } from '../../utils/profitMarginReportPrint';
import './ProfitMarginReportPanel.css';

interface ProfitMarginReportPanelProps {
  store: Store;
}

export function ProfitMarginReportPanel({ store }: ProfitMarginReportPanelProps) {
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [search, setSearch] = useState('');

  const allRows = useMemo(
    () => buildProfitMarginReportRows(store.products),
    [store.products],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((row) => {
      if (onlyInStock && row.stock <= 0) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q)
        || row.productCode.toLowerCase().includes(q)
        || row.barcode.toLowerCase().includes(q)
      );
    });
  }, [allRows, onlyInStock, search]);

  const businessName = store.settings.businessName?.trim() || 'Mağaza';

  const handlePrintPdf = () => {
    openProfitMarginReportPrint({
      businessName,
      generatedAt: new Date(),
      rows: allRows,
    });
  };

  return (
    <div className="profit-margin-report">
      <p className="module-hint">
        Tüm ürünlerin alış (KDV hariç), partner ve perakende fiyatları ile alış maliyetine göre kar marjları.
        <strong> PDF / A4 yazdır</strong> tarayıcıda «PDF olarak kaydet» veya yazıcı seçerek kullanılır.
      </p>

      <div className="profit-margin-report-toolbar">
        <label className="profit-margin-report-search">
          <span>Ara</span>
          <input
            type="search"
            value={search}
            placeholder="Kod, barkod veya ürün adı"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="accounting-checkbox profit-margin-report-stock-filter">
          <input
            type="checkbox"
            checked={onlyInStock}
            onChange={(e) => setOnlyInStock(e.target.checked)}
          />
          Sadece stoklu ürünler (ekranda)
        </label>
        <button type="button" className="btn btn-primary" onClick={handlePrintPdf}>
          PDF / A4 yazdır
        </button>
        <span className="profit-margin-report-count">
          {rows.length} / {allRows.length} ürün
        </span>
      </div>

      <div className="profit-margin-report-table-wrap module-card">
        <table className="module-table profit-margin-report-table">
          <thead>
            <tr>
              <th>Stok kodu</th>
              <th>Barkod</th>
              <th>Ürün adı</th>
              <th className="num">Alış (KDV hariç)</th>
              <th className="num">Partner</th>
              <th className="num">Partner kar %</th>
              <th className="num">Perakende</th>
              <th className="num">Perakende kar %</th>
              <th className="num">Stok</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="module-empty">Kayıt bulunamadı</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.productId}>
                  <td><code>{row.productCode}</code></td>
                  <td className="mono">{row.barcode || '—'}</td>
                  <td>{row.name}</td>
                  <td className="num">{formatCurrencyTry(row.purchaseNet)}</td>
                  <td className="num">{formatCurrencyTry(row.partnerNet)}</td>
                  <td className={`num${row.partnerMarginPct != null && row.partnerMarginPct < 0 ? ' is-loss' : ''}`}>
                    {formatMarginPercent(row.partnerMarginPct)}
                  </td>
                  <td className="num">{formatCurrencyTry(row.retailNet)}</td>
                  <td className={`num${row.retailMarginPct != null && row.retailMarginPct < 0 ? ' is-loss' : ''}`}>
                    {formatMarginPercent(row.retailMarginPct)}
                  </td>
                  <td className="num">{row.stock}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
