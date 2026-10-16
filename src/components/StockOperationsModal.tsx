import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCategoryLabel } from '../data/categories';
import type { AppSettings } from '../types/business';
import { listProductCategorySelectOptions } from '../utils/productCategories';
import type { Product, WholesalePrices } from '../types/product';
import type { ProductPricingInput } from '../utils/productPricing';
import type { ProductSet, ProductSetItem } from '../types/productSet';
import { ProductImage } from './ProductImage';
import { isCustomImage } from '../utils/productImage';
import { ProductSetPanel } from './ProductSetPanel';
import { formatCurrency } from '../utils/format';
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
  onUploadImage?: (productId: number, imageUrl: string) => void;
  onRemoveImage?: (productId: number) => void;
  onUpdatePricing?: (productId: number, input: ProductPricingInput) => void;
  onPricingSaveResult?: (saved: boolean) => void;
  /** Lima / pos-lite: perakende KDV hariç */
  perakendeKdvHaric?: boolean;
  settings?: AppSettings;
  onUpdateProductCategory?: (productId: number, categoryId: string) => void;
  onManageCategories?: () => void;
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
  onUploadImage,
  onRemoveImage,
  onUpdatePricing,
  onPricingSaveResult,
  perakendeKdvHaric = false,
  settings,
  onUpdateProductCategory,
  onManageCategories,
}: StockOperationsModalProps) {
  const [operation, setOperation] = useState<StockOperationType>(initialOperation);
  const [productId, setProductId] = useState('');
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [barcodeDraft, setBarcodeDraft] = useState('');
  const [purchaseDraft, setPurchaseDraft] = useState('');
  const [partnerDraft, setPartnerDraft] = useState('');
  const [couponDraft, setCouponDraft] = useState('');
  const [retailDraft, setRetailDraft] = useState('');
  const [categoryDraft, setCategoryDraft] = useState('');

  const categoryOptions = useMemo(
    () => listProductCategorySelectOptions(settings),
    [settings],
  );

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

  useEffect(() => {
    setCategoryDraft(selectedProduct?.category ?? '');
  }, [selectedProduct?.id, selectedProduct?.category]);

  useEffect(() => {
    if (!selectedProduct) {
      setPurchaseDraft('');
      setPartnerDraft('');
      setCouponDraft('');
      setRetailDraft('');
      return;
    }
    setPurchaseDraft(selectedProduct.purchasePrice > 0 ? String(selectedProduct.purchasePrice) : '');
    setPartnerDraft(selectedProduct.partnerPrice > 0 ? String(selectedProduct.partnerPrice) : '');
    setCouponDraft(
      (selectedProduct.couponPrice ?? 0) > 0 ? String(selectedProduct.couponPrice) : '',
    );
    setRetailDraft(selectedProduct.fullSalePrice > 0 ? String(selectedProduct.fullSalePrice) : '');
  }, [
    selectedProduct?.id,
    selectedProduct?.purchasePrice,
    selectedProduct?.partnerPrice,
    selectedProduct?.couponPrice,
    selectedProduct?.fullSalePrice,
  ]);

  const parsePriceDraft = (draft: string): number | undefined => {
    const normalized = draft.trim().replace(',', '.');
    if (!normalized) return undefined;
    const value = Number.parseFloat(normalized);
    if (!Number.isFinite(value) || value < 0) return undefined;
    return value;
  };

  const priceDraftChanged = (draft: number | undefined, current: number) => {
    if (draft == null) return false;
    return Math.abs(draft - current) > 0.004;
  };

  const buildPricingPatch = (): ProductPricingInput | null => {
    if (!selectedProduct || !onUpdatePricing) return null;
    const patch: ProductPricingInput = {};
    const purchase = parsePriceDraft(purchaseDraft);
    const partner = parsePriceDraft(partnerDraft);
    const coupon = parsePriceDraft(couponDraft);
    const retail = parsePriceDraft(retailDraft);
    if (priceDraftChanged(purchase, selectedProduct.purchasePrice)) patch.purchasePrice = purchase;
    if (priceDraftChanged(partner, selectedProduct.partnerPrice)) patch.partnerPrice = partner;
    const couponBase = selectedProduct.couponPrice ?? selectedProduct.partnerPrice;
    if (priceDraftChanged(coupon, couponBase)) patch.couponPrice = coupon;
    if (priceDraftChanged(retail, selectedProduct.fullSalePrice)) patch.fullSalePrice = retail;
    return Object.keys(patch).length > 0 ? patch : null;
  };

  const applyPricingDraft = (): boolean => {
    const id = Number.parseInt(productId, 10);
    if (Number.isNaN(id) || !onUpdatePricing) return false;
    const patch = buildPricingPatch();
    if (!patch) return false;
    onUpdatePricing(id, patch);
    return true;
  };

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

  const previewPricing = useMemo(() => {
    if (!selectedProduct) return null;
    return {
      purchase: parsePriceDraft(purchaseDraft) ?? selectedProduct.purchasePrice,
      partner: parsePriceDraft(partnerDraft) ?? selectedProduct.partnerPrice,
      coupon: parsePriceDraft(couponDraft) ?? selectedProduct.couponPrice ?? selectedProduct.partnerPrice,
      retail: parsePriceDraft(retailDraft) ?? selectedProduct.fullSalePrice,
    };
  }, [selectedProduct, purchaseDraft, partnerDraft, couponDraft, retailDraft]);

  const previewStockValue = useMemo(() => {
    if (!previewPricing || previewStock == null) return null;
    return previewStock * previewPricing.purchase;
  }, [previewPricing, previewStock]);

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

    applyPricingDraft();

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
                <div className="stock-ops-dialog__photo-col">
                  <ProductImage
                    product={selectedProduct}
                    size="lg"
                    editable={Boolean(onUploadImage)}
                    onUpload={onUploadImage}
                    onRemove={onRemoveImage}
                  />
                  {onUploadImage && (
                    <div className="stock-ops-dialog__photo-actions">
                      <button
                        type="button"
                        className="stock-ops-dialog__photo-btn"
                        onClick={() => {
                          const input = document.querySelector(
                            '.stock-ops-dialog__selected .image-upload-input',
                          ) as HTMLInputElement | null;
                          input?.click();
                        }}
                      >
                        📷 {isCustomImage(selectedProduct) ? 'Fotoğrafı değiştir' : 'Fotoğraf ekle'}
                      </button>
                      {isCustomImage(selectedProduct) && onRemoveImage && (
                        <button
                          type="button"
                          className="stock-ops-dialog__photo-btn stock-ops-dialog__photo-btn--muted"
                          onClick={() => onRemoveImage(selectedProduct.id)}
                        >
                          Kaldır
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="stock-ops-dialog__selected-info">
                  <div className="stock-ops-dialog__selected-top">
                    {onUpdateProductCategory ? (
                      <label className="stock-ops-dialog__category-field">
                        <span>Kategori</span>
                        <div className="stock-ops-dialog__category-row">
                          <select
                            value={categoryDraft}
                            onChange={(e) => {
                              const next = e.target.value;
                              setCategoryDraft(next);
                              onUpdateProductCategory(selectedProduct.id, next);
                            }}
                          >
                            {categoryOptions.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.icon} {cat.label}
                              </option>
                            ))}
                          </select>
                          {onManageCategories && (
                            <button
                              type="button"
                              className="stock-ops-dialog__category-manage"
                              onClick={onManageCategories}
                            >
                              Düzenle
                            </button>
                          )}
                        </div>
                      </label>
                    ) : (
                      <span className="stock-cat-pill">
                        {getCategoryLabel(selectedProduct.category, settings)}
                      </span>
                    )}
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

            {selectedProduct && onUpdatePricing && (
              <fieldset className="stock-ops-dialog__pricing">
                <legend>Fiyatlar (₺)</legend>
                <p className="stock-ops-dialog__pricing-hint">
                  Mevcut ürün ve stok girişinde aynı kayıt güncellenir.
                  {perakendeKdvHaric ? ' Perakende — KDV hariç (kasa ile uyumlu).' : ' Perakende — liste (KDV hariç); kasa KDV dahil.'}
                </p>
                <div className="stock-ops-dialog__pricing-grid">
                  <label className="stock-ops-dialog__field">
                    <span>Alış</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={purchaseDraft}
                      placeholder="0,00"
                      onChange={(e) => setPurchaseDraft(e.target.value)}
                    />
                  </label>
                  <label className="stock-ops-dialog__field">
                    <span>Partner</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={partnerDraft}
                      placeholder="0,00"
                      onChange={(e) => setPartnerDraft(e.target.value)}
                    />
                  </label>
                  <label className="stock-ops-dialog__field">
                    <span>Kupon</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={couponDraft}
                      placeholder="0,00"
                      onChange={(e) => setCouponDraft(e.target.value)}
                    />
                  </label>
                  <label className="stock-ops-dialog__field">
                    <span>{perakendeKdvHaric ? 'Perakende (KDV hariç)' : 'Perakende'}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={retailDraft}
                      placeholder="0,00"
                      onChange={(e) => setRetailDraft(e.target.value)}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  className="stock-ops-dialog__pricing-save"
                  onClick={() => onPricingSaveResult?.(applyPricingDraft())}
                >
                  Fiyatları kaydet
                </button>
              </fieldset>
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
              <div className="stock-ops-dialog__preview-head">
                <p className="stock-ops-dialog__preview-label">İşlem özeti</p>
                <span className={`stock-ops-dialog__preview-badge stock-ops-dialog__preview-badge--${activeOperation.tone}`}>
                  {activeOperation.icon} {activeOperation.label}
                </span>
              </div>

              {selectedProduct ? (
                <div className="stock-ops-dialog__preview-body">
                  <h4 className="stock-ops-dialog__preview-title" title={selectedProduct.name}>
                    {selectedProduct.name}
                  </h4>

                  <div className="stock-ops-dialog__preview-block">
                    <p className="stock-ops-dialog__preview-block-title">Ürün</p>
                    <div className="stock-ops-dialog__preview-rows">
                      <div className="stock-ops-dialog__preview-row">
                        <span>Kod</span>
                        <strong>{selectedProduct.productCode?.trim() || '—'}</strong>
                      </div>
                      <div className="stock-ops-dialog__preview-row">
                        <span>No</span>
                        <strong>{selectedProduct.id}</strong>
                      </div>
                      <div className="stock-ops-dialog__preview-row">
                        <span>Barkod</span>
                        <strong className="stock-ops-dialog__preview-mono">
                          {barcodeDraft.trim() || selectedProduct.barcode?.trim() || '—'}
                        </strong>
                      </div>
                      <div className="stock-ops-dialog__preview-row">
                        <span>Kategori</span>
                        <strong>{getCategoryLabel(selectedProduct.category, settings)}</strong>
                      </div>
                      {selectedStatus && (
                        <div className="stock-ops-dialog__preview-row">
                          <span>Durum</span>
                          <strong>{getStockStatusLabel(selectedStatus)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="stock-ops-dialog__preview-block">
                    <p className="stock-ops-dialog__preview-block-title">Stok</p>
                    <div className="stock-ops-dialog__preview-flow">
                      <div>
                        <span>Mevcut</span>
                        <strong>{selectedProduct.stock}</strong>
                      </div>
                      <span className="stock-ops-dialog__preview-arrow" aria-hidden>→</span>
                      <div>
                        <span>Yeni</span>
                        <strong className={previewDelta < 0 ? 'is-down' : previewDelta > 0 ? 'is-up' : ''}>
                          {previewStock ?? selectedProduct.stock}
                        </strong>
                      </div>
                    </div>
                    {operation !== 'clear' && hasValidQty && (
                      <p className="stock-ops-dialog__preview-hint">
                        {operation === 'in' && `+${parsedQty} adet giriş`}
                        {operation === 'out' && `−${parsedQty} adet çıkış`}
                        {operation === 'set' && `Sayım: ${parsedQty} adet`}
                      </p>
                    )}
                    {operation === 'clear' && (
                      <p className="stock-ops-dialog__preview-hint stock-ops-dialog__preview-hint--warn">
                        Stok sıfırlanacak
                      </p>
                    )}
                    {previewDelta !== 0 && (
                      <p className={`stock-ops-dialog__preview-delta ${previewDelta > 0 ? 'is-up' : 'is-down'}`}>
                        Net değişim: {previewDelta > 0 ? '+' : ''}{previewDelta} adet
                      </p>
                    )}
                  </div>

                  {previewPricing && onUpdatePricing && (
                    <div className="stock-ops-dialog__preview-block">
                      <p className="stock-ops-dialog__preview-block-title">
                        Fiyatlar {perakendeKdvHaric ? '(perakende KDV hariç)' : ''}
                      </p>
                      <div className="stock-ops-dialog__preview-rows">
                        <div className="stock-ops-dialog__preview-row">
                          <span>Alış</span>
                          <strong>{formatCurrency(previewPricing.purchase)}</strong>
                        </div>
                        <div className="stock-ops-dialog__preview-row">
                          <span>Partner</span>
                          <strong>{formatCurrency(previewPricing.partner)}</strong>
                        </div>
                        <div className="stock-ops-dialog__preview-row">
                          <span>Kupon</span>
                          <strong>{formatCurrency(previewPricing.coupon)}</strong>
                        </div>
                        <div className="stock-ops-dialog__preview-row stock-ops-dialog__preview-row--accent">
                          <span>Perakende</span>
                          <strong>{formatCurrency(previewPricing.retail)}</strong>
                        </div>
                      </div>
                      {previewStockValue != null && previewStockValue > 0 && (
                        <p className="stock-ops-dialog__preview-hint">
                          Stok değeri (alış × yeni): {formatCurrency(previewStockValue)}
                        </p>
                      )}
                    </div>
                  )}

                  {note.trim() && (
                    <div className="stock-ops-dialog__preview-block">
                      <p className="stock-ops-dialog__preview-block-title">Not</p>
                      <p className="stock-ops-dialog__preview-note">{note.trim()}</p>
                    </div>
                  )}
                </div>
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
