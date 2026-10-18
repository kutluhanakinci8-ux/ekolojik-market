import { useMemo, useState } from 'react';
import type { Product, WholesalePrices } from '../types/product';
import type { ProductSet, ProductSetItem } from '../types/productSet';
import { formatCurrency } from '../utils/format';
import { sumSetComponentRetail } from '../utils/setPricing';
import { ProductImage } from './ProductImage';
import './ProductSetModal.css';

interface ProductSetPanelProps {
  products: Product[];
  productSets: ProductSet[];
  onSave: (data: {
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
  onAssemble: (setId: string, quantity: number, note?: string) => { ok: boolean; message?: string };
  onAdjustStock: (setId: string, delta: number, note?: string) => void;
  onRemove: (setId: string) => void;
}

const EMPTY_WHOLESALE: WholesalePrices = { qty10: 0, qty20: 0, qty50: 0, qty100: 0 };

function emptyForm() {
  return {
    stockCode: '',
    name: '',
    description: '',
    ourPriceWithVat: '',
    partnerPriceWithVat: '',
    wholesalePrices: { ...EMPTY_WHOLESALE },
    isActive: true,
    items: [] as ProductSetItem[],
    assembleQty: '1',
    assembleNote: '',
  };
}

function formFromSet(set: ProductSet) {
  return {
    stockCode: set.stockCode,
    name: set.name,
    description: set.description ?? '',
    ourPriceWithVat: String(set.ourPriceWithVat),
    partnerPriceWithVat: String(set.partnerPriceWithVat),
    wholesalePrices: set.wholesalePrices ?? { ...EMPTY_WHOLESALE },
    isActive: set.isActive,
    items: set.items.map((item) => ({ ...item })),
    assembleQty: '1',
    assembleNote: '',
  };
}

export function ProductSetPanel({
  products,
  productSets,
  onSave,
  onAssemble,
  onAdjustStock,
  onRemove,
}: ProductSetPanelProps) {
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);

  const activeSet = activeSetId ? productSets.find((set) => set.id === activeSetId) : undefined;

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? products.filter((product) =>
        product.name.toLowerCase().includes(q)
        || String(product.id).includes(q)
        || (product.productCode ?? '').toLowerCase().includes(q),
      )
      : products;
    return list.slice(0, 10);
  }, [products, search]);

  const componentRetailTotal = useMemo(
    () => sumSetComponentRetail(products, form.items),
    [products, form.items],
  );

  const parsedRetail = Number.parseFloat(form.ourPriceWithVat);
  const parsedPartner = Number.parseFloat(form.partnerPriceWithVat);
  const parsedAssembleQty = Number.parseInt(form.assembleQty, 10);

  const addItem = (productId: number) => {
    setForm((prev) => {
      const existing = prev.items.find((item) => item.productId === productId);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        };
      }
      return { ...prev, items: [...prev.items, { productId, quantity: 1 }] };
    });
  };

  const updateItemQty = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      setForm((prev) => ({ ...prev, items: prev.items.filter((item) => item.productId !== productId) }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
    }));
  };

  const handleSave = () => {
    setError(null);
    const saved = onSave({
      id: activeSetId ?? undefined,
      stockCode: form.stockCode,
      name: form.name,
      description: form.description,
      items: form.items,
      ourPriceWithVat: parsedRetail,
      partnerPriceWithVat: parsedPartner,
      wholesalePrices: form.wholesalePrices,
      isActive: form.isActive,
    });
    if (!saved) {
      setError('Stok kodu, set adı ve en az bir ürün gerekli');
      return;
    }
    setActiveSetId(saved.id);
    setForm(formFromSet(saved));
  };

  const handleAssemble = () => {
    if (!activeSet) return;
    setError(null);
    const result = onAssemble(activeSet.id, parsedAssembleQty, form.assembleNote || 'Set montajı');
    if (!result.ok) {
      setError(result.message ?? 'Montaj yapılamadı');
      return;
    }
    setForm((prev) => ({ ...prev, assembleQty: '1', assembleNote: '' }));
  };

  return (
    <div className="product-set-panel">
      {showList ? (
        <div className="product-set-list-view">
          <div className="product-set-list-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowList(false);
                setActiveSetId(null);
                setForm(emptyForm());
              }}
            >
              ＋ Yeni Set
            </button>
          </div>

          {productSets.length === 0 ? (
            <p className="product-set-empty">Henüz set tanımlanmadı. Yeni set oluşturun.</p>
          ) : (
            <div className="product-set-table-wrap">
              <table className="product-set-table">
                <thead>
                  <tr>
                    <th>Stok No</th>
                    <th>Set Adı</th>
                    <th>İçerik</th>
                    <th>Stok</th>
                    <th>Fiyat</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {productSets.map((set) => (
                    <tr key={set.id}>
                      <td>{set.stockCode}</td>
                      <td>
                        <strong>{set.name}</strong>
                        {!set.isActive && <span className="product-set-inactive">Pasif</span>}
                      </td>
                      <td>{set.items.reduce((sum, item) => sum + item.quantity, 0)} ürün</td>
                      <td>{set.stock}</td>
                      <td>{formatCurrency(set.ourPriceWithVat)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setShowList(false);
                            setActiveSetId(set.id);
                            setForm(formFromSet(set));
                          }}
                        >
                          Düzenle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="product-set-form">
          {error && <p className="product-set-error" role="alert">{error}</p>}

          <div className="product-set-form-grid">
            <label className="product-set-field">
              <span>Stok Numarası</span>
              <input
                type="text"
                value={form.stockCode}
                onChange={(e) => setForm((prev) => ({ ...prev, stockCode: e.target.value }))}
                placeholder="STK-SET-003"
              />
            </label>
            <label className="product-set-field">
              <span>Set Adı</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ekolojik Bakım Seti"
              />
            </label>
            <label className="product-set-field product-set-field--full">
              <span>Açıklama (isteğe bağlı)</span>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </label>
          </div>

          <div className="product-set-prices">
            <label className="product-set-field">
              <span>Perakende (KDV dahil)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.ourPriceWithVat}
                onChange={(e) => setForm((prev) => ({ ...prev, ourPriceWithVat: e.target.value }))}
              />
            </label>
            <label className="product-set-field">
              <span>Partner (KDV dahil)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.partnerPriceWithVat}
                onChange={(e) => setForm((prev) => ({ ...prev, partnerPriceWithVat: e.target.value }))}
              />
            </label>
            <p className="product-set-hint">
              Bileşen perakende toplamı: <strong>{formatCurrency(componentRetailTotal)}</strong>
            </p>
          </div>

          <div className="product-set-items">
            <h3>Set İçeriği</h3>
            <div className="search-box product-set-search">
              <span className="search-icon">🔍</span>
              <input
                type="search"
                placeholder="Ürün ara — ad, kod veya no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <ul className="product-set-search-results">
              {searchResults.map((product) => (
                <li key={product.id}>
                  <button type="button" className="product-set-search-item" onClick={() => addItem(product.id)}>
                    <ProductImage product={product} size="sm" />
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.productCode ?? ''} · No {product.id} · Stok {product.stock}</span>
                    </div>
                    <span className="product-set-add-chip">+</span>
                  </button>
                </li>
              ))}
            </ul>

            {form.items.length === 0 ? (
              <p className="product-set-empty">Sete eklenecek ürünleri seçin</p>
            ) : (
              <ul className="product-set-selected">
                {form.items.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  if (!product) return null;
                  return (
                    <li key={item.productId} className="product-set-selected-item">
                      <ProductImage product={product} size="sm" />
                      <div className="product-set-selected-info">
                        <strong>{product.name}</strong>
                        <span>Stok: {product.stock}</span>
                      </div>
                      <div className="qty-control">
                        <button type="button" onClick={() => updateItemQty(item.productId, item.quantity - 1)}>−</button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updateItemQty(item.productId, item.quantity + 1)}>+</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {activeSet && (
            <div className="product-set-assemble">
              <h3>Montaj & Stok</h3>
              <p className="product-set-hint">
                Mevcut set stoku: <strong>{activeSet.stock}</strong> adet
              </p>
              <div className="product-set-assemble-row">
                <label className="product-set-field">
                  <span>Monte edilecek adet</span>
                  <input
                    type="number"
                    min="1"
                    value={form.assembleQty}
                    onChange={(e) => setForm((prev) => ({ ...prev, assembleQty: e.target.value }))}
                  />
                </label>
                <label className="product-set-field">
                  <span>Not</span>
                  <input
                    type="text"
                    value={form.assembleNote}
                    onChange={(e) => setForm((prev) => ({ ...prev, assembleNote: e.target.value }))}
                    placeholder="Set montajı"
                  />
                </label>
                <button type="button" className="btn btn-primary" onClick={handleAssemble}>
                  Monte Et
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => onAdjustStock(activeSet.id, 1, 'Manuel set girişi')}
                >
                  +1 Stok
                </button>
              </div>
            </div>
          )}

          <label className="product-set-active">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Kasada görünür (aktif)
          </label>

          <div className="product-set-actions">
            <button type="button" className="btn btn-outline" onClick={() => setShowList(true)}>
              ← Listeye Dön
            </button>
            {activeSet && (
              <button
                type="button"
                className="btn btn-outline product-set-delete"
                onClick={() => {
                  if (confirm(`"${activeSet.name}" seti silinsin mi?`)) {
                    onRemove(activeSet.id);
                    setShowList(true);
                    setActiveSetId(null);
                    setForm(emptyForm());
                  }
                }}
              >
                Sil
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              {activeSet ? 'Kaydet' : 'Set Oluştur'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
