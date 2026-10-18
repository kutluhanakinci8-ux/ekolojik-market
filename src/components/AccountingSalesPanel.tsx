import { useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import type { Sale } from '../types/product';
import { filterByBusinessDate } from '../utils/cashSession';
import { getBusinessDateKey, getBusinessDateKeyFromIso } from '../utils/businessDate';
import { formatCurrency, formatDateTime } from '../utils/format';
import type { CompletedSalePatch } from '../store/saleAdmin';
import './AccountingSalesPanel.css';

const PAYMENT_LABELS: Record<Sale['paymentMethod'], string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  credit: 'Veresiye',
  split: 'Bölünmüş',
};

interface AccountingSalesPanelProps {
  store: Store;
}

function resolveSaleBusinessDate(sale: Sale): string {
  return sale.businessDate?.trim() || getBusinessDateKeyFromIso(sale.createdAt);
}

function saleItemSummary(sale: Sale, productNameById: Map<number, string>): string {
  const parts = (sale.items ?? []).slice(0, 3).map((item) => {
    const pid = item.productId;
    const name = pid != null
      ? (productNameById.get(pid) ?? `Ürün #${pid}`)
      : (item.setId ? `Set ${item.setId}` : 'Kalem');
    return `${name} ×${item.quantity}`;
  });
  const extra = (sale.items?.length ?? 0) > 3 ? ` +${(sale.items?.length ?? 0) - 3}` : '';
  return parts.length ? `${parts.join(', ')}${extra}` : '—';
}

export function AccountingSalesPanel({ store }: AccountingSalesPanelProps) {
  const defaultDate = store.activeBusinessDate || getBusinessDateKey();
  const [dateKey, setDateKey] = useState(defaultDate);
  const [editing, setEditing] = useState<Sale | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<CompletedSalePatch['paymentMethod']>('cash');
  const [totalInput, setTotalInput] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [greenleafNumber, setGreenleafNumber] = useState('');
  const [businessDate, setBusinessDate] = useState('');
  const [note, setNote] = useState('');

  const productNameById = useMemo(
    () => new Map(store.products.map((p) => [p.id, p.name])),
    [store.products],
  );

  const daySales = useMemo(() => {
    const rows = filterByBusinessDate(store.sales, dateKey);
    return [...rows].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [store.sales, dateKey]);

  const dayTotal = useMemo(
    () => daySales.reduce((sum, s) => sum + s.total, 0),
    [daySales],
  );

  const openEdit = (sale: Sale) => {
    setEditing(sale);
    setFormError(null);
    const method = sale.paymentMethod === 'split' ? 'cash' : sale.paymentMethod;
    setPaymentMethod(method);
    setTotalInput(String(sale.total).replace('.', ','));
    setCustomerName(sale.customerName ?? '');
    setGreenleafNumber(sale.greenleafNumber ?? '');
    setBusinessDate(resolveSaleBusinessDate(sale));
    setNote(sale.paymentCorrectionNote ?? '');
  };

  const closeEdit = () => {
    setEditing(null);
    setFormError(null);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4500);
  };

  const handleSave = () => {
    if (!editing) return;
    const parsed = parseFloat(totalInput.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) {
      setFormError('Geçerli bir tutar girin');
      return;
    }
    const patch: CompletedSalePatch = {
      paymentMethod,
      total: parsed,
      customerName,
      greenleafNumber,
      businessDate,
      note,
    };
    const result = store.updateCompletedSale(editing.id, patch);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    closeEdit();
    showToast(`Satış güncellendi — ${editing.id}`);
  };

  return (
    <section className="accounting-sales-panel module-card">
      <div className="accounting-sales-toolbar">
        <div className="accounting-sales-toolbar-main">
          <label className="accounting-sales-date">
            <span>Gün</span>
            <input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
            />
          </label>
          <p className="accounting-sales-summary">
            <strong>{daySales.length}</strong> satış · Toplam <strong>{formatCurrency(dayTotal)}</strong>
          </p>
        </div>
        <p className="module-hint accounting-sales-hint">
          Ödeme tipi ve tutar düzenlemesi kasa listesine yansır. Stok satır adedi buradan değiştirilmez.
        </p>
      </div>

      <div className="accounting-sales-table-wrap">
        <table className="module-table module-table--wide accounting-sales-table">
          <thead>
            <tr>
              <th>Saat</th>
              <th>Fiş no</th>
              <th>Müşteri</th>
              <th>Ödeme</th>
              <th className="num">Tutar</th>
              <th>Özet</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {daySales.length === 0 ? (
              <tr>
                <td colSpan={7} className="module-empty">Bu gün için satış kaydı yok</td>
              </tr>
            ) : (
              daySales.map((sale) => (
                <tr key={sale.id}>
                  <td>{formatDateTime(sale.createdAt)}</td>
                  <td><code className="accounting-sales-id">{sale.id}</code></td>
                  <td>
                    {sale.customerName || sale.greenleafNumber || 'Perakende'}
                    {sale.greenleafNumber && sale.customerName ? (
                      <small className="accounting-sales-gl"> · {sale.greenleafNumber}</small>
                    ) : null}
                  </td>
                  <td>
                    <span className={`accounting-sales-pay accounting-sales-pay--${sale.paymentMethod}`}>
                      {PAYMENT_LABELS[sale.paymentMethod]}
                    </span>
                  </td>
                  <td className="num">{formatCurrency(sale.total)}</td>
                  <td className="accounting-sales-items">{saleItemSummary(sale, productNameById)}</td>
                  <td className="accounting-sales-actions">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openEdit(sale)}>
                      Düzenle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="accounting-sales-modal-backdrop" role="presentation" onClick={closeEdit}>
          <div
            className="accounting-sales-modal"
            role="dialog"
            aria-labelledby="accounting-sales-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="accounting-sales-modal-head">
              <h2 id="accounting-sales-edit-title">Satış düzenle</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeEdit}>Kapat</button>
            </header>
            <p className="module-hint"><code>{editing.id}</code> · {formatDateTime(editing.createdAt)}</p>

            <div className="accounting-sales-form-grid">
              <label>
                Ödeme tipi
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as CompletedSalePatch['paymentMethod'])}
                >
                  <option value="cash">Nakit</option>
                  <option value="card">Kart</option>
                  <option value="transfer">Havale</option>
                  <option value="credit">Veresiye</option>
                </select>
              </label>
              <label>
                Tutar (₺)
                <input
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  inputMode="decimal"
                />
              </label>
              <label>
                İş günü
                <input
                  type="date"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                />
              </label>
              <label>
                Müşteri adı
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </label>
              <label>
                Greenleaf no
                <input value={greenleafNumber} onChange={(e) => setGreenleafNumber(e.target.value)} />
              </label>
              <label className="accounting-sales-form-note">
                Not
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
              </label>
            </div>

            {formError && <p className="sale-return-error" role="alert">{formError}</p>}

            <footer className="accounting-sales-modal-foot">
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                Kaydet
              </button>
            </footer>
          </div>
        </div>
      )}

      {toast && (
        <div className="accounting-sales-toast" role="status">{toast}</div>
      )}
    </section>
  );
}
