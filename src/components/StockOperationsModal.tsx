import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCategoryLabel } from '../data/categories';
import type { Product, WholesalePrices } from '../types/product';
import type { ProductSet, ProductSetItem } from '../types/productSet';
import { ProductImage } from './ProductImage';
import { ProductSetPanel } from './ProductSetPanel';
import './StockOperationsModal.css';

export type StockOperationType = 'in' | 'out' | 'set' | 'clear' | 'bundle';

interface StockOperationsModalProps {
  open: boolean;
  products: Product[];
  productSets: ProductSet[];
  lowStockThreshold: number;
  initialProductId?: number;
  initialOperation?: StockOperationType;
  onClose: () => void;
  onAdjust: (productId: number, delta: number, note: string) => void;
  onSetStock: (productId: number, stock: number, note: string) => void;
  onSaveSet: (data: {
    id?: string;
    stockCode: string;
    name: string;
    description?: string;
    items: ProductSetItem[];
    ourPriceWithVat: number;
    partnerPriceWithVat: number;
    wholesalePrices?: WholesalePrices;
    isActive?: boolean;
  }) => ProductSet | null;
  onAssembleSet: (setId: string, quantity: number, note?: string) => { ok: boolean; message?: string };
  onAdjustSetStock: (setId: string, delta: number, note?: string) => void;
  onRemoveSet: (setId: string) => void;
  onUpdateBarcode?: (productId: number, barcode: string) => void;
}

const OPERATIONS: Array<{
  id: StockOperationType;
  label: string;
  hint: string;
  icon: string;
  tone: 'in' | 'out' | 'set' | 'clear' | 'bundle';
}> = [
  { id: 'in', label: 'Giriş', hint: 'Stoğa ekle', icon: '↗', tone: 'in' },
  { id: 'out', label: 'Çıkış', hint: 'Stoktan düş', icon: '↘', tone: 'out' },
  { id: 'set', label: 'Sayım', hint: 'Miktar belirle', icon: '✎', tone: 'set' },
  { id: 'clear', label: 'Sıfırla', hint: 'Stok = 0', icon: '⊘', tone: 'clear' },
  { id: 'bundle', label: 'Set Oluştur', hint: 'Ürün paketi', icon: '🎁', tone: 'bundle' as const },
];

const QUICK_AMOUNTS = [1, 5, 10, 25, 50, 100];

function getStockStatus(product: Product, threshold: number): 'ok' | 'low' | 'out' {
  if (product.stock <= 0) return 'out';
  if (product.stock <= threshold) return 'low';
  return 'ok';
}

function getStockStatusLabel(status: 'ok' | 'low' | 'out'): string {
  if (status === 'out') return 'Tükendi';
  if (status === 'low') return 'Az Stok';
  return 'Yeterli';
}

function defaultNote(operation: StockOperationType): string {
  switch (operation) {
    case 'in':
      return 'Stok girişi';
    case 'out':
      return 'Stok çıkışı';
    case 'set':
      return 'Stok sayımı / düzeltme';
    case 'clear':
      return 'Stok sıfırlama';
    default:
      return 'Stok işlemi';
  }
}

export function StockOperationsModal({
  open,
  products,
  productSets,
  lowStockThreshold,
  initialProductId,
  initialOperation = 'in',
  onClose,
  onAdjust,
  onSetStock,
  onSaveSet,
  onAssembleSet,
  onAdjustSetStock,
  onRemoveSet,
  onUpdateBarcode,
}: StockOperationsModalProps) {
  const [operation, setOperation] = useState<StockOperationType>(initialOperation);
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [barcodeDraft, setBarcodeDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    setOperation(initialOperation);
    setProductId(initialProductId ? String(initialProductId) : '');
    setSearch('');
    setQuantity('');
    setNote('');
  }, [open, initialProductId, initialOperation]);

  const selectedProduct = useMemo(() => {
    const id = Number.parseInt(productId, 10);
    if (Number.isNaN(id)) return undefined;
    return products.find((product) => product.id === id);
  }, [productId, products]);

  useEffect(() => {
    setBarcodeDraft(selectedProduct?.barcode ?? '');
  }, [selectedProduct?.id, selectedProduct?.barcode]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? products.filter((product) =>
        product.name.toLowerCase().includes(q)
        || String(product.id).includes(q)
        || (product.productCode ?? '').toLowerCase().includes(q)
        || (product.barcode ?? '').toLowerCase().includes(q),
      )
      : products;
    return list.slice(0, 12);
  }, [products, search]);

  const parsedQty = Number.parseInt(quantity, 10);
  const hasValidQty = !Number.isNaN(parsedQty) && parsedQty > 0;

  const previewStock = useMemo(() => {
    if (!selectedProduct) return null;
    if (operation === 'clear') return 0;
    if (!hasValidQty) return selectedProduct.stock;
    if (operation === 'in') return selectedProduct.stock + parsedQty;
    if (operation === 'out') return Math.max(0, selectedProduct.stock - parsedQty);
    if (operation === 'set') return Math.max(0, parsedQty);
    return selectedProduct.stock;
  }, [selectedProduct, operation, hasValidQty, parsedQty]);

  const previewDelta = selectedProduct && previewStock != null
    ? previewStock - selectedProduct.stock
    : 0;

  const activeOperation = OPERATIONS.find((item) => item.id === operation)!;

  const selectProduct = (product: Product) => {
    setProductId(String(product.id));
    setSearch(product.productCode ?? product.name);
  };

  const clearProduct = () => {
    setProductId('');
    setSearch('');
  };

  const applyQuickAmount = (amount: number) => {
    if (operation === 'set') {
      setQuantity(String(amount));
      return;
    }
    const current = Number.parseInt(quantity, 10);
    const base = Number.isNaN(current) ? 0 : current;
    setQuantity(String(base + amount));
  };

  const handleSubmit = () => {
    const id = Number.parseInt(productId, 10);
    if (Number.isNaN(id) || !selectedProduct) return;

    const trimmedNote = note.trim() || defaultNote(operation);

    if (operation === 'clear') {
      if (!window.confirm(`${selectedProduct.name} stoğu sıfırlansın mı?`)) return;
      onSetStock(id, 0, trimmedNote);
      onClose();
      return;
    }

    if (!hasValidQty) return;

    if (operation === 'set') {
      onSetStock(id, parsedQty, trimmedNote);
      onClose();
      return;
    }

    const delta = operation === 'in' ? parsedQty : -parsedQty;
    if (operation === 'out' && selectedProduct.stock - parsedQty < 0) {
      if (!window.confirm(`Stok ${selectedProduct.stock} adet. ${parsedQty} çıkış yapılsın mı? (0'a düşer)`)) return;
    }
    onAdjust(id, delta, trimmedNote);
    onClose();
  };

  const canSubmit = Boolean(selectedProduct) && (operation === 'clear' || hasValidQty);
  const submitLabel = operation === 'clear'
    ? 'Stoku Sıfırla'
    : operation === 'set'
      ? 'Stoku Güncelle'
      : operation === 'in'
        ? 'Stok Girişi Yap'
        : 'Stok Çıkışı Yap';

  const quantityLabel = operation === 'set'
    ? 'Yeni stok miktarı'
    : operation === 'in'
      ? 'Eklenecek miktar'
      : 'Çıkarılacak miktar';

  if (!open) return null;

  const selectedStatus = selectedProduct ? getStockStatus(selectedProduct, lowStockThreshold) : null;

  return createPortal(
    <div className="stock-ops-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="stock-ops-dialog"
        style={{ width: 'min(960px, calc(100vw - 48px))', maxWidth: '960px' }}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="stock-ops-dialog__header">
          <div>
            <p className="stock-ops-dialog__eyebrow">Stok Merkezi</p>
            <h2>Stok İşlemleri</h2>
          </div>
          <button type="button" className="stock-ops-dialog__close" onClick={onClose} aria-label="Kapat">×</button>
        </header>

        <div className="stock-ops-dialog__tabs" role="tablist" aria-label="Stok işlem tipi">
          {OPERATIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={operation === item.id}
              className={`stock-ops-dialog__tab stock-ops-dialog__tab--${item.tone} ${operation === item.id ? 'is-active' : ''}`}
              onClick={() => {
                setOperation(item.id);
                setQuantity('');
              }}
            >
              <span className="stock-ops-dialog__tab-icon" aria-hidden>{item.icon}</span>
              <span className="stock-ops-dialog__tab-text">
                <strong>{item.label}</strong>
                <small>{item.hint}</small>
              </span>
            </button>
          ))}
        </div>

        {operation === 'bundle' ? (
          <div className="stock-ops-dialog__body stock-ops-dialog__body--bundle">
            <ProductSetPanel
              products={products}
              productSets={productSets}
              onSave={onSaveSet}
              onAssemble={onAssembleSet}
              onAdjustStock={onAdjustSetStock}
              onRemove={onRemoveSet}
            />
            <div className="stock-ops-dialog__footer stock-ops-dialog__footer--bundle">
              <button type="button" className="btn btn-outline" onClick={onClose}>Kapat</button>
            </div>
          </div>
        ) : (
        <div className="stock-ops-dialog__body">
          <section className="stock-ops-dialog__main">
            <div className="stock-ops-dialog__search">
              <span className="stock-ops-dialog__search-icon" aria-hidden>🔍</span>
              <input
                type="search"
                placeholder="Ürün ara — ad, kod veya no..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  if (selectedProduct) clearProduct();
                }}
              />
              {selectedProduct && (
                <button type="button" className="stock-ops-dialog__search-clear" onClick={clearProduct}>
                  Temizle
                </button>
              )}
            </div>

            {selectedProduct ? (
              <div className="stock-ops-dialog__selected">
                <ProductImage product={selectedProduct} size="md" />
                <div className="stock-ops-dialog__selected-info">
                  <div className="stock-ops-dialog__selected-top">
                    <span className="stock-cat-pill">{getCategoryLabel(selectedProduct.category)}</span>
                    {selectedStatus && (
                      <span className={`stock-ops-dialog__status stock-ops-dialog__status--${selectedStatus}`}>
                        {getStockStatusLabel(selectedStatus)}
                      </span>
                    )}
                  </div>
                  <h3>{selectedProduct.name}</h3>
                  <p>
                    {selectedProduct.productCode ? `${selectedProduct.productCode} · ` : ''}
                    No {selectedProduct.id}
                  </p>
                  {onUpdateBarcode && (
                    <label className="stock-ops-dialog__barcode-field">
                      <span>Barkod (okuyucu)</span>
                      <input
                        type="text"
                        value={barcodeDraft}
                        placeholder={selectedProduct.productCode ?? `Stok no ${selectedProduct.id}`}
                        autoComplete="off"
                        spellCheck={false}
                        onChange={(e) => setBarcodeDraft(e.target.value)}
                        onBlur={() => onUpdateBarcode(selectedProduct.id, barcodeDraft)}
                      />
                    </label>
                  )}
                </div>
                <div className="stock-ops-dialog__selected-stock">
                  <span>Mevcut</span>
                  <strong>{selectedProduct.stock}</strong>
                </div>
              </div>
            ) : (
              <div className="stock-ops-dialog__products">
                {searchResults.length === 0 ? (
                  <p className="stock-ops-dialog__empty">Ürün bulunamadı</p>
                ) : (
                  searchResults.map((product) => {
                    const status = getStockStatus(product, lowStockThreshold);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        className="stock-ops-dialog__product"
                        onClick={() => selectProduct(product)}
                      >
                        <ProductImage product={product} size="sm" />
                        <div className="stock-ops-dialog__product-text">
                          <strong>{product.name}</strong>
                          <span>
                            {product.productCode ? `${product.productCode} · ` : ''}No {product.id}
                          </span>
                        </div>
                        <span className={`stock-qty stock-qty--${status}`}>{product.stock}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}

            {operation === 'clear' && selectedProduct && (
              <div className="stock-ops-dialog__alert">
                Bu işlem seçili ürünün stok miktarını <strong>0</strong> yapar.
              </div>
            )}

            {operation !== 'clear' && (
              <div className="stock-ops-dialog__quantity">
                <label className="stock-ops-dialog__field">
                  <span>{quantityLabel}</span>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    placeholder={operation === 'set' ? 'Örn. 120' : 'Örn. 50'}
                  />
                </label>
                <div className="stock-ops-dialog__chips" aria-label="Hızlı miktar">
                  {QUICK_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      type="button"
                      className="stock-ops-dialog__chip"
                      onClick={() => applyQuickAmount(amount)}
                    >
                      {operation === 'set' ? amount : `+${amount}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="stock-ops-dialog__field">
              <span>Not (isteğe bağlı)</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={defaultNote(operation)}
              />
            </label>
          </section>

          <aside className="stock-ops-dialog__aside">
            <div className="stock-ops-dialog__preview">
              <p className="stock-ops-dialog__preview-label">İşlem Özeti</p>
              <span className={`stock-ops-dialog__preview-badge stock-ops-dialog__preview-badge--${activeOperation.tone}`}>
                {activeOperation.icon} {activeOperation.label}
              </span>

              {selectedProduct ? (
                <>
                  <h4>{selectedProduct.name}</h4>
                  <div className="stock-ops-dialog__preview-flow">
                    <div>
                      <span>Mevcut</span>
                      <strong>{selectedProduct.stock}</strong>
                    </div>
                    <span aria-hidden>→</span>
                    <div>
                      <span>Yeni</span>
                      <strong className={previewDelta < 0 ? 'is-down' : previewDelta > 0 ? 'is-up' : ''}>
                        {previewStock ?? selectedProduct.stock}
                      </strong>
                    </div>
                  </div>
                  {previewDelta !== 0 && (
                    <p className={`stock-ops-dialog__preview-delta ${previewDelta > 0 ? 'is-up' : 'is-down'}`}>
                      {previewDelta > 0 ? '+' : ''}{previewDelta} adet
                    </p>
                  )}
                </>
              ) : (
                <p className="stock-ops-dialog__empty">İşlem için ürün seçin</p>
              )}
            </div>

            <div className="stock-ops-dialog__footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>İptal</button>
              <button
                type="button"
                className={`btn ${operation === 'clear' ? 'btn-danger-soft' : 'btn-primary'}`}
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitLabel}
              </button>
            </div>
          </aside>
        </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
