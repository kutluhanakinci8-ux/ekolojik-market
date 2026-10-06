import { useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import { DEFAULT_VAT_RATE, splitGrossAmount } from '../utils/vatAnalytics';
import { formatCurrency } from '../utils/format';

interface PurchaseInvoicesPanelProps {
  store: Store;
}

function todayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function PurchaseInvoicesPanel({ store }: PurchaseInvoicesPanelProps) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIsoDate());
  const [grossAmount, setGrossAmount] = useState('');
  const [vatRate, setVatRate] = useState(String(DEFAULT_VAT_RATE));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  const preview = useMemo(() => {
    const gross = parseFloat(grossAmount);
    const rate = parseFloat(vatRate);
    if (Number.isNaN(gross) || gross <= 0 || Number.isNaN(rate) || rate < 0) return null;
    return splitGrossAmount(gross, rate);
  }, [grossAmount, vatRate]);

  const totals = useMemo(() => ({
    gross: store.purchaseInvoices.reduce((sum, invoice) => sum + invoice.grossAmount, 0),
    vat: store.purchaseInvoices.reduce((sum, invoice) => sum + invoice.vatAmount, 0),
  }), [store.purchaseInvoices]);

  const handleSubmit = () => {
    setError(null);
    const gross = parseFloat(grossAmount);
    const rate = parseFloat(vatRate);
    if (!invoiceNo.trim()) {
      setError('Fatura numarası zorunludur.');
      return;
    }
    if (!supplierName.trim()) {
      setError('Tedarikçi adı zorunludur.');
      return;
    }
    if (!invoiceDate) {
      setError('Fatura tarihi zorunludur.');
      return;
    }
    if (Number.isNaN(gross) || gross <= 0) {
      setError('Geçerli bir KDV dahil tutar girin.');
      return;
    }
    if (Number.isNaN(rate) || rate < 0) {
      setError('Geçerli bir KDV oranı girin.');
      return;
    }

    store.addPurchaseInvoice({
      invoiceNo: invoiceNo.trim(),
      supplierName: supplierName.trim(),
      invoiceDate,
      grossAmount: gross,
      vatRate: rate,
      notes: notes.trim() || undefined,
    });

    setInvoiceNo('');
    setSupplierName('');
    setGrossAmount('');
    setNotes('');
  };

  const sortedInvoices = useMemo(
    () => [...store.purchaseInvoices].sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate)),
    [store.purchaseInvoices],
  );

  return (
    <div className="purchase-invoices-panel">
      <div className="module-grid-2 purchase-invoices-layout">
        <section className="module-card">
          <h2>Mal Alış Faturası Gir</h2>
          <p className="module-hint">KDV dahil tutarı girin; matrah ve KDV otomatik hesaplanır.</p>

          <div className="module-form">
            <label>
              Fatura No
              <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="ALF-2026-011" />
            </label>
            <label>
              Tedarikçi
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Firma adı" />
            </label>
            <label>
              Fatura Tarihi
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </label>
            <label>
              KDV Dahil Tutar (₺)
              <input type="number" min="0" step="0.01" value={grossAmount} onChange={(e) => setGrossAmount(e.target.value)} />
            </label>
            <label>
              KDV Oranı (%)
              <input type="number" min="0" step="1" value={vatRate} onChange={(e) => setVatRate(e.target.value)} />
            </label>
            <label>
              Not
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsiyonel" />
            </label>

            {preview && (
              <div className="purchase-invoice-preview">
                <span>Matrah: <strong>{formatCurrency(preview.netAmount)}</strong></span>
                <span>KDV: <strong>{formatCurrency(preview.vatAmount)}</strong></span>
              </div>
            )}

            {error && <p className="login-error" role="alert">{error}</p>}

            <button type="button" className="btn btn-primary" onClick={handleSubmit}>
              Faturayı Kaydet
            </button>
          </div>
        </section>

        <section className="module-card module-card--flush">
          <div className="module-card-toolbar purchase-invoices-toolbar">
            <div>
              <h2>Alış Faturaları</h2>
              <p>{sortedInvoices.length} fatura · indirilecek KDV {formatCurrency(totals.vat)}</p>
            </div>
            <div className="purchase-invoices-toolbar-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSeedMessage(null);
                  const result = store.seedDemoSupplierData();
                  if (result.ok) {
                    setSeedMessage('Örnek tedarikçi (Ekolojik Tedarik Ltd.) ve 2 stoklu alış faturası eklendi.');
                  } else if (result.reason === 'already_seeded') {
                    setSeedMessage('Örnek tedarikçi faturaları zaten kayıtlı.');
                  } else {
                    setSeedMessage('Ürün kataloğu eksik; örnek alış oluşturulamadı.');
                  }
                }}
              >
                Örnek Tedarikçi + 2 Alış
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => store.seedDemoVatData()}>
                Demo KDV Verisi
              </button>
            </div>
          </div>

          {seedMessage && <p className="module-hint purchase-invoices-seed-hint">{seedMessage}</p>}

          <p className="module-hint purchase-invoices-path-hint">
            Bu form yalnızca <strong>KDV / indirilecek vergi</strong> kaydı oluşturur (stok ve tedarikçi cari defteri güncellenmez).
            Stoklu alış için <strong>Muhasebe → Fiş Girişi → Alış Faturası</strong> kullanın.
          </p>

          <table className="module-table module-table--wide">
            <thead>
              <tr>
                <th>Fatura</th>
                <th>Tarih</th>
                <th>Tedarikçi</th>
                <th>Matrah</th>
                <th>KDV</th>
                <th>Toplam</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sortedInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="mono">{invoice.invoiceNo}</td>
                  <td>{invoice.invoiceDate}</td>
                  <td>{invoice.supplierName}</td>
                  <td>{formatCurrency(invoice.netAmount)}</td>
                  <td>{formatCurrency(invoice.vatAmount)}</td>
                  <td><strong>{formatCurrency(invoice.grossAmount)}</strong></td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        if (confirm('Bu faturayı silmek istiyor musunuz?')) {
                          const result = store.removePurchaseInvoice(invoice.id);
                          if (!result.ok) {
                            setError(result.message ?? 'Fatura silinemedi.');
                          }
                        }
                      }}
                    >
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {sortedInvoices.length === 0 && (
            <p className="module-empty">Henüz alış faturası yok. Demo veri yükleyebilir veya yeni fatura girebilirsiniz.</p>
          )}
        </section>
      </div>
    </div>
  );
}
