import { useEffect, useMemo, useState } from 'react';
import type { Store } from '../store/useStore';
import type { CartItem, PriceType, Product, Sale } from '../types/product';
import { filterByBusinessDate } from '../utils/cashSession';
import { getBusinessDateKey, getBusinessDateKeyFromIso } from '../utils/businessDate';
import { formatCurrency, formatDateTime } from '../utils/format';
import { resolveSaleBarcode } from '../utils/productBarcode';
import { foldTurkish } from '../utils/productSearch';
import { resolveRetailSaleUnitPrice } from '../utils/productPricing';
import { formatSalePaymentLabel, sumSaleLineTotal, type CompletedSalePatch } from '../store/saleAdmin';
import { isGiftSale, resolveGiftRetailGross } from '../utils/giftSale';
import './AccountingSalesPanel.css';

const PAYMENT_LABELS: Record<Sale['paymentMethod'], string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  credit: 'Veresiye',
  split: 'Bölünmüş',
  gift: 'Hediye',
};

interface AccountingSalesPanelProps {
  store: Store;
}

interface EditLineRow {
  key: string;
  productId: number;
  quantity: number;
  unitPrice: number;
  priceType: PriceType;
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

function parseMoneyInput(value: string): number {
  return parseFloat(value.replace(',', '.'));
}

function formatMoneyInput(amount: number): string {
  return String(amount).replace('.', ',');
}

function productSearchLabel(product: Product): string {
  const code = product.productCode?.trim() || `#${product.id}`;
  const barcode = resolveSaleBarcode(product) ?? '';
  return barcode ? `${code} · ${barcode} — ${product.name}` : `${code} — ${product.name}`;
}

function findProductByScan(products: Product[], raw: string): Product | undefined {
  const q = raw.trim();
  if (!q) return undefined;
  const folded = foldTurkish(q).replace(/\s/g, '');
  return products.find((p) => {
    const code = foldTurkish(p.productCode ?? '').replace(/\s/g, '');
    const barcode = (resolveSaleBarcode(p) ?? '').replace(/\s/g, '');
    return code === folded || barcode === q || String(p.id) === q;
  });
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
  const [lineRows, setLineRows] = useState<EditLineRow[]>([]);
  const [preservedSetLines, setPreservedSetLines] = useState<CartItem[]>([]);
  const [addProductId, setAddProductId] = useState('');
  const [addUnitPrice, setAddUnitPrice] = useState('');
  const [barcodeAdd, setBarcodeAdd] = useState('');
  const [splitCashInput, setSplitCashInput] = useState('');
  const [splitCardInput, setSplitCardInput] = useState('');

  const productById = useMemo(
    () => new Map(store.products.map((p) => [p.id, p])),
    [store.products],
  );

  const productNameById = useMemo(
    () => new Map(store.products.map((p) => [p.id, p.name])),
    [store.products],
  );

  const sortedProducts = useMemo(
    () => [...store.products].sort((a, b) => {
      const ac = a.productCode ?? '';
      const bc = b.productCode ?? '';
      return ac.localeCompare(bc, 'tr');
    }),
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

  const linesCartPreview = useMemo((): CartItem[] => [
    ...lineRows.map((row) => ({
      productId: row.productId,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      priceType: row.priceType,
    })),
    ...preservedSetLines,
  ], [lineRows, preservedSetLines]);

  const computedLinesTotal = useMemo(
    () => sumSaleLineTotal(linesCartPreview),
    [linesCartPreview],
  );

  useEffect(() => {
    if (!editing) return;
    if (paymentMethod === 'gift') {
      setTotalInput(formatMoneyInput(0));
      return;
    }
    setTotalInput(formatMoneyInput(computedLinesTotal));
  }, [computedLinesTotal, editing, paymentMethod]);

  const openEdit = (sale: Sale) => {
    setEditing(sale);
    setFormError(null);
    setPaymentMethod(sale.paymentMethod);
    const cashPart = sale.paymentSplits?.find((s) => s.method === 'cash')?.amount;
    const cardPart = sale.paymentSplits?.find((s) => s.method === 'card')?.amount;
    setSplitCashInput(cashPart != null ? formatMoneyInput(cashPart) : '');
    setSplitCardInput(cardPart != null ? formatMoneyInput(cardPart) : '');
    setTotalInput(formatMoneyInput(sale.total));
    setCustomerName(sale.customerName ?? '');
    setGreenleafNumber(sale.greenleafNumber ?? '');
    setBusinessDate(resolveSaleBusinessDate(sale));
    setNote(sale.paymentCorrectionNote ?? '');
    setPreservedSetLines((sale.items ?? []).filter((line) => line.setId && !line.productId));
    setLineRows(
      (sale.items ?? [])
        .filter((line) => line.productId)
        .map((line, index) => ({
          key: `line-${sale.id}-${index}-${line.productId}`,
          productId: line.productId!,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          priceType: line.priceType,
        })),
    );
    setAddProductId('');
    setAddUnitPrice('');
    setBarcodeAdd('');
  };

  const closeEdit = () => {
    setEditing(null);
    setFormError(null);
    setLineRows([]);
    setPreservedSetLines([]);
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4500);
  };

  const updateLine = (key: string, patch: Partial<EditLineRow>) => {
    setLineRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeLine = (key: string) => {
    setLineRows((prev) => prev.filter((row) => row.key !== key));
  };

  const resolveAddUnitPrice = (productId: number): number => {
    const manual = parseMoneyInput(addUnitPrice);
    if (addUnitPrice.trim() && !Number.isNaN(manual) && manual >= 0) return manual;
    const product = productById.get(productId);
    return product ? resolveRetailSaleUnitPrice(product) : 0;
  };

  const syncAddPriceFromProduct = (productId: number) => {
    const product = productById.get(productId);
    if (!product) {
      setAddUnitPrice('');
      return;
    }
    setAddUnitPrice(formatMoneyInput(resolveRetailSaleUnitPrice(product)));
  };

  const addProductLine = (productId: number, unitPriceOverride?: number) => {
    const product = productById.get(productId);
    if (!product) return;
    const unitPrice = unitPriceOverride ?? resolveAddUnitPrice(productId);
    setLineRows((prev) => [
      ...prev,
      {
        key: `line-new-${Date.now()}-${productId}`,
        productId,
        quantity: 1,
        unitPrice,
        priceType: 'our',
      },
    ]);
  };

  const handleAddFromSelect = () => {
    const id = parseInt(addProductId, 10);
    if (!id) {
      setFormError('Ürün seçin');
      return;
    }
    setFormError(null);
    addProductLine(id);
    setAddProductId('');
    setAddUnitPrice('');
  };

  const handleAddFromBarcode = () => {
    const product = findProductByScan(store.products, barcodeAdd);
    if (!product) {
      setFormError(`Barkod/kod bulunamadı: ${barcodeAdd.trim()}`);
      return;
    }
    setFormError(null);
    addProductLine(product.id);
    setBarcodeAdd('');
    setAddUnitPrice('');
  };

  const handleSave = () => {
    if (!editing) return;
    const manualTotal = parseMoneyInput(totalInput);
    const items: CartItem[] = [
      ...lineRows.map((row) => ({
        productId: row.productId,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        priceType: row.priceType,
      })),
      ...preservedSetLines,
    ];
    const patch: CompletedSalePatch = {
      paymentMethod,
      total: paymentMethod === 'gift'
        ? 0
        : (Number.isNaN(manualTotal) ? undefined : manualTotal),
      customerName,
      greenleafNumber,
      businessDate,
      note,
      items,
    };
    if (paymentMethod === 'split') {
      const cash = parseMoneyInput(splitCashInput);
      const card = parseMoneyInput(splitCardInput);
      patch.paymentSplits = [
        { method: 'cash', amount: cash },
        { method: 'card', amount: card },
      ];
    }
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
          Ödeme tipi (nakit+kart dahil) ve satır fiyatları düzenlenebilir; stok hareketi otomatik güncellenmez.
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
                      {sale.paymentMethod === 'split' && sale.paymentSplits?.length
                        ? formatSalePaymentLabel(sale)
                        : PAYMENT_LABELS[sale.paymentMethod]}
                    </span>
                  </td>
                  <td className="num">
                    {formatCurrency(sale.total)}
                    {isGiftSale(sale) ? (
                      <small className="accounting-sales-gift-value">
                        hediye {formatCurrency(resolveGiftRetailGross(sale))}
                      </small>
                    ) : null}
                  </td>
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
            className="accounting-sales-modal accounting-sales-modal--wide"
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
                  <option value="split">Nakit + Kart (bölünmüş)</option>
                  <option value="gift">Hediye (ücretsiz — raporda zarar)</option>
                </select>
              </label>
              {paymentMethod === 'split' && (
                <>
                  <label>
                    Nakit (₺)
                    <input
                      value={splitCashInput}
                      onChange={(e) => setSplitCashInput(e.target.value)}
                      inputMode="decimal"
                      placeholder="ör. 180"
                    />
                  </label>
                  <label>
                    Kart (₺)
                    <input
                      value={splitCardInput}
                      onChange={(e) => setSplitCardInput(e.target.value)}
                      inputMode="decimal"
                      placeholder="ör. 600"
                    />
                  </label>
                </>
              )}
              <label>
                Tutar (₺)
                <input
                  value={totalInput}
                  onChange={(e) => setTotalInput(e.target.value)}
                  inputMode="decimal"
                  readOnly={paymentMethod === 'gift'}
                  disabled={paymentMethod === 'gift'}
                />
                <span className="accounting-sales-field-hint">
                  {paymentMethod === 'gift'
                    ? `Hediye: müşteri 0 ₺ öder. Zarar raporu: ${formatCurrency(computedLinesTotal)} (satır toplamı)`
                    : `Satır toplamı: ${formatCurrency(computedLinesTotal)}`}
                </span>
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

            <section className="accounting-sales-lines">
              <div className="accounting-sales-lines-head">
                <h3>Satılan ürünler</h3>
              </div>
              <div className="accounting-sales-lines-table-wrap">
                <table className="module-table accounting-sales-lines-table">
                  <thead>
                    <tr>
                      <th>Kod</th>
                      <th>Barkod</th>
                      <th>Ürün</th>
                      <th className="num">Adet</th>
                      <th className="num">Birim (₺)</th>
                      <th className="num">Satır</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {lineRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="module-empty">Ürün satırı yok — ekleyin</td>
                      </tr>
                    ) : (
                      lineRows.map((row) => {
                        const product = productById.get(row.productId);
                        const lineTotal = row.quantity * row.unitPrice;
                        return (
                          <tr key={row.key}>
                            <td><code>{product?.productCode ?? row.productId}</code></td>
                            <td className="accounting-sales-barcode">
                              {product ? (resolveSaleBarcode(product) ?? '—') : '—'}
                            </td>
                            <td className="accounting-sales-line-name">
                              <select
                                value={row.productId}
                                onChange={(e) => {
                                  const nextId = parseInt(e.target.value, 10);
                                  const nextProduct = productById.get(nextId);
                                  updateLine(row.key, {
                                    productId: nextId,
                                    unitPrice: nextProduct
                                      ? resolveRetailSaleUnitPrice(nextProduct)
                                      : row.unitPrice,
                                  });
                                }}
                              >
                                {sortedProducts.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {productSearchLabel(p)}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="num">
                              <input
                                className="accounting-sales-line-input"
                                type="number"
                                min={1}
                                step={1}
                                value={row.quantity}
                                onChange={(e) => updateLine(row.key, {
                                  quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                                })}
                              />
                            </td>
                            <td className="num">
                              <input
                                className="accounting-sales-line-input"
                                inputMode="decimal"
                                value={formatMoneyInput(row.unitPrice)}
                                onChange={(e) => {
                                  const v = parseMoneyInput(e.target.value);
                                  if (!Number.isNaN(v)) updateLine(row.key, { unitPrice: v });
                                }}
                              />
                            </td>
                            <td className="num">{formatCurrency(lineTotal)}</td>
                            <td className="accounting-sales-line-actions">
                              <button
                                type="button"
                                className="btn btn-ghost btn-sm"
                                onClick={() => removeLine(row.key)}
                                aria-label="Satırı sil"
                              >
                                Sil
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {preservedSetLines.length > 0 && (
                <p className="module-hint accounting-sales-set-hint">
                  Set satırları korunuyor ({preservedSetLines.length}) — bu ekrandan değiştirilmez.
                </p>
              )}

              <div className="accounting-sales-add-row">
                <label>
                  Ürün ekle
                  <select
                    value={addProductId}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAddProductId(next);
                      const id = parseInt(next, 10);
                      if (id) syncAddPriceFromProduct(id);
                      else setAddUnitPrice('');
                    }}
                  >
                    <option value="">Seçin…</option>
                    {sortedProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {productSearchLabel(p)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="accounting-sales-add-price">
                  Birim fiyat (₺)
                  <input
                    value={addUnitPrice}
                    onChange={(e) => setAddUnitPrice(e.target.value)}
                    inputMode="decimal"
                    placeholder="Katalog"
                  />
                </label>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleAddFromSelect}>
                  Ekle
                </button>
                <label className="accounting-sales-barcode-add">
                  Barkod / kod
                  <input
                    value={barcodeAdd}
                    onChange={(e) => setBarcodeAdd(e.target.value)}
                    placeholder="6955470959966 veya KLA128T"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddFromBarcode(); }}
                  />
                </label>
                <button type="button" className="btn btn-outline btn-sm" onClick={handleAddFromBarcode}>
                  Okut / Ara
                </button>
              </div>
            </section>

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
