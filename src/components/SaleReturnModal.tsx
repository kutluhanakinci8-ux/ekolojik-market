import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Product, Sale } from '../types/product';
import type { ProductSet } from '../types/productSet';
import { formatCurrency, formatDateTime } from '../utils/format';
import { displayCustomerName } from '../utils/cashierPrivacy';
import { canReturnSale, getReturnableLines, type ReturnableLine } from '../utils/saleReturn';
import type { SaleReturn } from '../types/saleReturn';
import { ProductImage } from './ProductImage';
import './SaleReturnModal.css';

const PAYMENT_LABELS = { cash: 'Nakit', card: 'Kart', transfer: 'Havale' };

const RETURN_REASONS = [
  'Müşteri memnuniyetsizliği',
  'Hatalı / hasarlı ürün',
  'Yanlış satış',
  'Değişim / beden uyumsuzluğu',
  'Diğer',
];

interface SaleReturnModalProps {
  open: boolean;
  sale: Sale | null;
  saleReturns: SaleReturn[];
  products: Product[];
  productSets: ProductSet[];
  cashierMode?: boolean;
  onClose: () => void;
  onConfirm: (
    saleId: string,
    lines: Array<{ lineKey: string; quantity: number }>,
    refundMethod: Sale['paymentMethod'],
    reason: string,
    note: string,
  ) => Promise<{ ok: boolean; message?: string }> | { ok: boolean; message?: string };
}

function getLineLabel(line: ReturnableLine, products: Product[], productSets: ProductSet[]): string {
  if (line.setId) {
    return productSets.find((set) => set.id === line.setId)?.name ?? `Set ${line.setId}`;
  }
  return products.find((product) => product.id === line.productId)?.name ?? `Ürün #${line.productId}`;
}

/** Satış satırındaki iade edilebilir adet — kasiyer varsayılan olarak bunu görür */
function buildDefaultReturnQuantities(lines: ReturnableLine[]): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const line of lines) {
    if (line.returnableQuantity > 0) {
      defaults[line.lineKey] = String(line.returnableQuantity);
    }
  }
  return defaults;
}

export function SaleReturnModal({
  open,
  sale,
  saleReturns,
  products,
  productSets,
  cashierMode = false,
  onClose,
  onConfirm,
}: SaleReturnModalProps) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [refundMethod, setRefundMethod] = useState<Sale['paymentMethod']>('cash');
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !sale) return;
    const lines = getReturnableLines(sale, saleReturns);
    setQuantities(buildDefaultReturnQuantities(lines));
    setRefundMethod(sale.paymentMethod);
    setReason(RETURN_REASONS[0]);
    setNote('');
    setError(null);
    setBusy(false);
  }, [open, sale, saleReturns]);

  const returnableLines = useMemo(
    () => (sale ? getReturnableLines(sale, saleReturns) : []),
    [sale, saleReturns],
  );

  const preview = useMemo(() => {
    let refundTotal = 0;
    let returnCount = 0;
    for (const line of returnableLines) {
      const qty = Number.parseInt(quantities[line.lineKey] ?? '0', 10);
      if (Number.isNaN(qty) || qty <= 0) continue;
      returnCount += qty;
      if (line.priceType !== 'sample') {
        refundTotal += line.unitPrice * qty;
      }
    }
    return { refundTotal, returnCount };
  }, [returnableLines, quantities]);

  if (!open || !sale) return null;

  const canProcess = canReturnSale(sale, saleReturns, { cashierMode });

  const handleSubmit = async () => {
    setError(null);
    const requested = returnableLines
      .map((line) => ({
        lineKey: line.lineKey,
        quantity: Number.parseInt(quantities[line.lineKey] ?? '0', 10),
      }))
      .filter((line) => !Number.isNaN(line.quantity) && line.quantity > 0);

    setBusy(true);
    try {
      const result = await onConfirm(sale.id, requested, refundMethod, reason, note);
      if (!result.ok) {
        setError(result.message ?? 'İade işlenemedi');
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="sale-return-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="sale-return-modal" onClick={(event) => event.stopPropagation()}>
        <header className="sale-return-header">
          <div>
            <span className="sale-return-kicker">İADE İŞLEMİ</span>
            <h2>Satış İptali / İade</h2>
          </div>
          <button type="button" className="sale-return-close" onClick={onClose} aria-label="Kapat">✕</button>
        </header>

        <section className="sale-return-sale-info">
          <div>
            <strong>Fiş:</strong> {sale.id}
          </div>
          <div>
            <strong>Tarih:</strong> {formatDateTime(sale.createdAt)}
          </div>
          <div>
            <strong>Satış kasiyeri:</strong> {sale.cashierName ?? '—'}
          </div>
          <div>
            <strong>Müşteri:</strong> {displayCustomerName(sale.customerName, cashierMode)}
          </div>
          <div>
            <strong>Satış tutarı:</strong> {formatCurrency(sale.total)}
          </div>
        </section>

        {!canProcess ? (
          <p className="sale-return-empty">Bu fiş için iade edilebilir ürün kalmadı.</p>
        ) : (
          <>
            <p className="sale-return-hint">
              {cashierMode
                ? 'İade adetleri satış fişinden otomatik gelir. Kısmi iade için − / + ile düzenleyin. 3 günü geçen işlemler için yöneticinize başvurun.'
                : 'İade adetleri satış fişinden otomatik gelir. Kısmi iade için − / + ile düzenleyin. Onay sonrası iade fişi yazdırılır.'}
            </p>

            <ul className="sale-return-lines">
              {returnableLines.filter((line) => line.returnableQuantity > 0).map((line) => {
                const product = line.productId ? products.find((p) => p.id === line.productId) : undefined;
                const label = getLineLabel(line, products, productSets);
                return (
                  <li key={line.lineKey} className="sale-return-line">
                    <div className="sale-return-line-info">
                      {product ? <ProductImage product={product} size="sm" /> : <div className="set-cart-thumb">🎁</div>}
                      <div>
                        <strong>{label}</strong>
                        <span>
                          Satılan: {line.soldQuantity}
                          {line.returnedQuantity > 0 ? ` · İade edildi: ${line.returnedQuantity}` : ''}
                          {line.priceType === 'sample' ? ' · Numune' : ` · ${formatCurrency(line.unitPrice)}`}
                        </span>
                      </div>
                    </div>
                    <div className="sale-return-line-qty">
                      <button
                        type="button"
                        onClick={() => setQuantities((prev) => ({
                          ...prev,
                          [line.lineKey]: String(Math.max(0, (Number.parseInt(prev[line.lineKey] ?? '0', 10) || 0) - 1)),
                        }))}
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        max={line.returnableQuantity}
                        value={quantities[line.lineKey] ?? String(line.returnableQuantity)}
                        onChange={(event) => setQuantities((prev) => ({
                          ...prev,
                          [line.lineKey]: event.target.value,
                        }))}
                      />
                      <button
                        type="button"
                        onClick={() => setQuantities((prev) => ({
                          ...prev,
                          [line.lineKey]: String(Math.min(
                            line.returnableQuantity,
                            (Number.parseInt(prev[line.lineKey] ?? '0', 10) || 0) + 1,
                          )),
                        }))}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className="sale-return-all-btn"
                        onClick={() => setQuantities((prev) => ({
                          ...prev,
                          [line.lineKey]: String(line.returnableQuantity),
                        }))}
                      >
                        Tümü
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="sale-return-form-grid">
              <label className="sale-return-field">
                <span>İade ödeme yöntemi</span>
                <select
                  value={refundMethod}
                  onChange={(event) => setRefundMethod(event.target.value as Sale['paymentMethod'])}
                >
                  {Object.entries(PAYMENT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="sale-return-field">
                <span>İade nedeni</span>
                <select value={reason} onChange={(event) => setReason(event.target.value)}>
                  {RETURN_REASONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="sale-return-field sale-return-field--full">
                <span>Not (isteğe bağlı)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ürün kontrol notu, müşteri açıklaması..."
                />
              </label>
            </div>

            <div className="sale-return-summary">
              <span>{preview.returnCount} adet iade</span>
              <strong>{preview.refundTotal > 0 ? formatCurrency(preview.refundTotal) : 'Ücretsiz (numune)'}</strong>
            </div>

            {error && <p className="sale-return-error" role="alert">{error}</p>}

            <div className="sale-return-actions">
              <button type="button" className="btn btn-outline" onClick={onClose}>Vazgeç</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={busy || preview.returnCount <= 0}
              >
                {busy ? 'İşleniyor...' : 'İadeyi Onayla'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
