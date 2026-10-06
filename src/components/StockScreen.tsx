import { useMemo, useState, type CSSProperties } from 'react';
import { CATEGORIES, getCategoryLabel } from '../data/categories';
import { APP_CATALOG_VERSION, EXPECTED_PRODUCT_COUNT } from '../data/appVersion';
import type { Store } from '../store/useStore';
import type { Product, WholesalePrices } from '../types/product';
import { formatCurrency, formatDateTime } from '../utils/format';
import { exportStockCsv, getStockHealthPercent, getStockInventoryValue } from '../utils/stockExport';
import {
  WHOLESALE_BASE_LABELS,
  WHOLESALE_QUANTITIES,
  type WholesalePriceBase,
} from '../utils/wholesalePricing';
import { ProductImage } from './ProductImage';
import { ProductSetModal } from './ProductSetModal';
import { StockOperationsModal, type StockOperationType } from './StockOperationsModal';

interface StockScreenProps {
  store: Store;
}

type StockFilter = 'all' | 'low' | 'out';
type SortKey = 'id' | 'name' | 'stock' | 'category' | 'value';
type SortDir = 'asc' | 'desc';
type WholesaleDisplayTier = typeof WHOLESALE_QUANTITIES[number];

function getWholesaleTierPrice(product: Product, tier: WholesaleDisplayTier): number | null {
  const prices = product.wholesalePrices;
  if (!prices) return null;
  const key = `qty${tier}` as keyof WholesalePrices;
  return prices[key];
}

const PAGE_SIZE = 20;

const MOVEMENT_ICONS: Record<string, string> = {
  in: '↗',
  out: '↘',
  sale: '🛒',
  sample: '🎁',
  adjust: '✎',
  set_assembly: '🎁',
  set_sale: '🛍️',
  return: '↩',
  set_return: '↩',
};

const MOVEMENT_LABELS: Record<string, string> = {
  in: 'Giriş',
  out: 'Çıkış',
  sale: 'Satış',
  sample: 'Numune',
  adjust: 'Düzeltme',
  set_assembly: 'Set Montajı',
  set_sale: 'Set Satışı',
  return: 'İade',
  set_return: 'Set İadesi',
};

const DEFAULT_WHOLESALE_DISCOUNTS = {
  qty10: '8',
  qty20: '13',
  qty50: '18',
  qty100: '24',
};

const DISABLED_WHOLESALE_BASES: WholesalePriceBase[] = ['purchase'];

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

export function StockScreen({ store }: StockScreenProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState<StockFilter>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [editingImages, setEditingImages] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('id');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(0);
  const [movementsOpen, setMovementsOpen] = useState(false);

  const [setModalOpen, setSetModalOpen] = useState(false);
  const [stockOpsOpen, setStockOpsOpen] = useState(false);
  const [stockOpsProductId, setStockOpsProductId] = useState<number | undefined>();
  const [stockOpsMode, setStockOpsMode] = useState<StockOperationType>('in');

  const [bulkWholesaleOpen, setBulkWholesaleOpen] = useState(false);
  const [bulkWholesaleBase, setBulkWholesaleBase] = useState<WholesalePriceBase>('retail');
  const [bulkWholesaleDiscounts, setBulkWholesaleDiscounts] = useState(DEFAULT_WHOLESALE_DISCOUNTS);
  const [wholesaleDisplayTier, setWholesaleDisplayTier] = useState<WholesaleDisplayTier>(10);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: store.products.length };
    for (const p of store.products) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    return counts;
  }, [store.products]);

  const inventoryValue = useMemo(
    () => getStockInventoryValue(store.products),
    [store.products],
  );

  const healthPercent = useMemo(
    () => getStockHealthPercent(store.products),
    [store.products],
  );

  const inStockCount = store.products.length - store.outOfStockCount;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = store.products.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (filter === 'low' && (p.stock <= 0 || p.stock > store.lowStockThreshold)) return false;
      if (filter === 'out' && p.stock > 0) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        String(p.id).includes(q) ||
        (p.productCode ?? '').toLowerCase().includes(q)
        || (p.barcode ?? '').toLowerCase().includes(q)
      );
    });

    const sorted = [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'tr');
          break;
        case 'stock':
          cmp = a.stock - b.stock;
          break;
        case 'category':
          cmp = getCategoryLabel(a.category).localeCompare(getCategoryLabel(b.category), 'tr');
          break;
        case 'value':
          cmp = a.stock * a.partnerPrice - b.stock * b.partnerPrice;
          break;
        default:
          cmp = a.id - b.id;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [store.products, search, filter, category, sortKey, sortDir, store.lowStockThreshold]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedProducts = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const todayMovements = useMemo(() => {
    const today = new Date().toDateString();
    return store.stockMovements.filter((m) => new Date(m.createdAt).toDateString() === today).length;
  }, [store.stockMovements]);

  const recentMovements = store.stockMovements.slice(0, 12);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const openStockOps = (productId?: number, mode: StockOperationType = 'in') => {
    setStockOpsProductId(productId);
    setStockOpsMode(mode);
    setStockOpsOpen(true);
  };

  const handleStockAdjust = (productId: number, delta: number, note: string) => {
    const product = store.products.find((item) => item.id === productId);
    store.adjustProductStock(productId, delta, note);
    if (product) {
      const verb = delta > 0 ? 'girişi' : 'çıkışı';
      showToast(`${product.name} için ${Math.abs(delta)} adet stok ${verb} yapıldı`);
    }
  };

  const handleStockSet = (productId: number, stock: number, note: string) => {
    const product = store.products.find((item) => item.id === productId);
    store.setProductStock(productId, stock, note);
    if (product) {
      showToast(stock === 0 ? `${product.name} stoğu sıfırlandı` : `${product.name} stok güncellendi`);
    }
  };

  const openBulkWholesale = () => {
    setBulkWholesaleBase('retail');
    setBulkWholesaleDiscounts(DEFAULT_WHOLESALE_DISCOUNTS);
    setBulkWholesaleOpen(true);
  };

  const applyBulkWholesale = () => {
    const discounts = {
      qty10: Number.parseFloat(bulkWholesaleDiscounts.qty10),
      qty20: Number.parseFloat(bulkWholesaleDiscounts.qty20),
      qty50: Number.parseFloat(bulkWholesaleDiscounts.qty50),
      qty100: Number.parseFloat(bulkWholesaleDiscounts.qty100),
    };
    if (Object.values(discounts).some((value) => Number.isNaN(value) || value < 0 || value > 100)) {
      showToast('İndirim yüzdeleri 0-100 arasında olmalı');
      return;
    }
    store.applyBulkWholesalePrices(bulkWholesaleBase, discounts, filtered.map((product) => product.id));
    setBulkWholesaleOpen(false);
    showToast(`${filtered.length} ürünün toptan fiyatları güncellendi`);
  };

  const openEditProduct = (product: Product) => {
    openStockOps(product.id, 'set');
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'stock' ? 'desc' : 'asc');
    }
    setPage(0);
  };

  const applyFilter = (next: StockFilter) => {
    setFilter(next);
    setPage(0);
  };

  const applyCategory = (id: string) => {
    setCategory(id);
    setPage(0);
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return '↕';
    return sortDir === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="stock-screen stock-screen--premium">
      {toast && <div className="sale-toast" role="status">✓ {toast}</div>}

      <div className="stock-main">
      <div className="stock-toolbar-premium">
        <div className="stock-toolbar-row">
          <div className="search-box stock-search">
            <span className="search-icon">🔍</span>
            <input
              type="search"
              placeholder="Ürün ara (ad, kod veya no)..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          <div className="stock-toolbar-actions">
            <button
              type="button"
              className={`btn btn-outline ${editingImages ? 'active' : ''}`}
              onClick={() => setEditingImages((v) => !v)}
            >
              {editingImages ? '✓ Resim Kapat' : '📷 Resim'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                exportStockCsv(filtered);
                showToast(`${filtered.length} ürün CSV olarak indirildi`);
              }}
            >
              ⬇ CSV
            </button>
            <button type="button" className="btn btn-outline" onClick={() => setSetModalOpen(true)}>
              🎁 Set Yönetimi
            </button>
            <button type="button" className="btn btn-outline" onClick={() => openStockOps()}>
              ＋ Stok İşlemleri
            </button>
            <button type="button" className="btn btn-primary" onClick={openBulkWholesale}>
              Toplu Fiyat
            </button>
          </div>
        </div>

        <div className="stock-toolbar-row stock-toolbar-row--filters">
          <div className="stock-category-chips">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`category-chip ${category === cat.id ? 'active' : ''}`}
                onClick={() => applyCategory(cat.id)}
              >
                <span>{cat.icon}</span>
                {cat.label}
                <span className="category-count">{categoryCounts[cat.id] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="stock-status-tabs">
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => applyFilter('all')}>
              Tümü
            </button>
            <button type="button" className={filter === 'low' ? 'active' : ''} onClick={() => applyFilter('low')}>
              Az Stok
            </button>
            <button type="button" className={filter === 'out' ? 'active' : ''} onClick={() => applyFilter('out')}>
              Tükenen
            </button>
          </div>
        </div>
      </div>

      <div className="stock-body">
        <div className="stock-table-panel">
          <div className="stock-table-bar">
            <span><strong>{filtered.length}</strong> ürün listeleniyor</span>
            {totalPages > 1 && (
              <div className="pagination">
                <button type="button" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>‹</button>
                <span>{safePage + 1} / {totalPages}</span>
                <button type="button" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>›</button>
              </div>
            )}
          </div>

          <div className="stock-table-wrap">
            <table className="stock-table stock-table--premium">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="stock-th-sort" onClick={() => toggleSort('id')}>
                      No {sortIndicator('id')}
                    </button>
                  </th>
                  <th>Resim</th>
                  <th>Kod</th>
                  <th>
                    <button type="button" className="stock-th-sort" onClick={() => toggleSort('category')}>
                      Kategori {sortIndicator('category')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="stock-th-sort" onClick={() => toggleSort('name')}>
                      Ürün Adı {sortIndicator('name')}
                    </button>
                  </th>
                  <th>PV</th>
                  <th>Alış</th>
                  <th>Partner</th>
                  <th>Kupon</th>
                  <th>Perakende</th>
                    <th className="stock-th-wholesale">
                      <label className="stock-wholesale-th">
                        <span>Toptan</span>
                        <select
                          className="stock-wholesale-tier-select"
                          value={wholesaleDisplayTier}
                          onChange={(event) => setWholesaleDisplayTier(Number(event.target.value) as WholesaleDisplayTier)}
                          aria-label="Toptan adet kademesi"
                        >
                          {WHOLESALE_QUANTITIES.map((qty) => (
                            <option key={qty} value={qty}>{qty}+</option>
                          ))}
                        </select>
                      </label>
                    </th>
                  <th>
                    <button type="button" className="stock-th-sort" onClick={() => toggleSort('stock')}>
                      Stok {sortIndicator('stock')}
                    </button>
                  </th>
                  <th>Numune</th>
                  <th>
                    <button type="button" className="stock-th-sort" onClick={() => toggleSort('value')}>
                      Değer {sortIndicator('value')}
                    </button>
                  </th>
                  <th className="stock-col-status" title="Durum">D</th>
                  <th className="stock-col-actions">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.map((p) => {
                  const status = getStockStatus(p, store.lowStockThreshold);
                  const lineValue = p.stock * p.partnerPrice;
                  const wholesalePrice = getWholesaleTierPrice(p, wholesaleDisplayTier);

                  return (
                    <tr key={p.id} className={`stock-row stock-row--${status}`}>
                      <td className="stock-id">{p.id}</td>
                      <td className="stock-image-cell">
                        <ProductImage
                          product={p}
                          size="sm"
                          editable={editingImages}
                          onUpload={store.updateProductImage}
                          onRemove={store.removeProductImage}
                        />
                      </td>
                      <td className="stock-product-code">{p.productCode ?? '—'}</td>
                      <td>
                        <span className="stock-cat-pill">{getCategoryLabel(p.category)}</span>
                      </td>
                      <td className="stock-name" title={p.name}>
                        {p.isSample && <span className="stock-sample-badge">NUMUNE</span>}
                        {p.name}
                      </td>
                      <td className="stock-num">{p.pv}</td>
                      <td className="stock-num">{formatCurrency(p.purchasePrice)}</td>
                      <td className="stock-num">{formatCurrency(p.partnerPrice)}</td>
                      <td className="stock-num">{p.couponPrice != null ? formatCurrency(p.couponPrice) : '—'}</td>
                      <td className="stock-num stock-sale-price">{formatCurrency(p.fullSalePrice)}</td>
                      <td className="stock-num stock-wholesale-price">
                        {wholesalePrice != null ? formatCurrency(wholesalePrice) : '—'}
                      </td>
                      <td>
                        <span className={`stock-qty stock-qty--${status}`}>{p.stock}</span>
                      </td>
                      <td>
                        {p.isSample ? (
                          <button
                            type="button"
                            className="stock-sample-qty-btn"
                            title="Numune stok düzenle"
                            onClick={() => {
                              const raw = window.prompt('Numune stok adedi', String(p.sampleStock ?? 0));
                              if (raw == null) return;
                              const value = Number.parseInt(raw, 10);
                              if (Number.isNaN(value) || value < 0) {
                                showToast('Geçerli bir adet girin');
                                return;
                              }
                              store.setProductSampleStock(p.id, value);
                              showToast(`Numune stok güncellendi: ${value}`);
                            }}
                          >
                            {p.sampleStock ?? 0}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline stock-sample-enable"
                            onClick={() => {
                              store.setProductSampleFlag(p.id, true);
                              store.setProductSampleStock(p.id, 0, 'Numune ürün olarak işaretlendi');
                              showToast(`${p.name} numune ürün olarak işaretlendi`);
                            }}
                          >
                            + Numune
                          </button>
                        )}
                      </td>
                      <td className="stock-num stock-value">{formatCurrency(lineValue)}</td>
                      <td className="stock-col-status">
                        <span
                          className={`stock-status-icon stock-status-icon--${status}`}
                          title={getStockStatusLabel(status)}
                          aria-label={getStockStatusLabel(status)}
                        >
                          {status === 'ok' ? '✓' : '✕'}
                        </span>
                      </td>
                      <td className="stock-col-actions">
                        <div className="stock-row-actions">
                          {p.isSample && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => {
                                store.setProductSampleFlag(p.id, false);
                                showToast('Numune işareti kaldırıldı');
                              }}
                            >
                              Numune kaldır
                            </button>
                          )}
                          <button type="button" className="btn btn-sm btn-outline" onClick={() => openEditProduct(p)}>
                            Düzenle
                          </button>
                          <button type="button" className="btn btn-sm btn-danger-soft" onClick={() => openStockOps(p.id, 'clear')}>
                            Sil
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="no-results">
                <p>Filtreye uygun ürün bulunamadı</p>
              </div>
            )}
          </div>
        </div>

        <aside className={`stock-movements stock-movements--premium ${movementsOpen ? 'is-open' : 'is-collapsed'}`}>
          <button
            type="button"
            className="stock-movements-toggle"
            onClick={() => setMovementsOpen((open) => !open)}
            aria-expanded={movementsOpen}
            aria-controls="stock-movements-panel"
            title={movementsOpen ? 'Son hareketleri gizle' : 'Son hareketleri göster'}
          >
            <span className="stock-movements-chevron" aria-hidden>
              {movementsOpen ? '›' : '‹'}
            </span>
            <span className="stock-movements-toggle-label">Son Hareketler</span>
            <span className="stock-movements-today">Bugün {todayMovements}</span>
          </button>

          {movementsOpen && (
            <div id="stock-movements-panel" className="stock-movements-body">
              {recentMovements.length === 0 ? (
                <p className="stock-movements-empty">Henüz hareket yok. Stok girişi yapın.</p>
              ) : (
                <ul className="stock-timeline">
                  {recentMovements.map((m) => (
                    <li key={m.id} className={`stock-timeline-item stock-timeline-item--${m.type}`}>
                      <div className="stock-timeline-icon">{MOVEMENT_ICONS[m.type]}</div>
                      <div className="stock-timeline-body">
                        <div className="stock-timeline-top">
                          <span className="stock-timeline-type">{MOVEMENT_LABELS[m.type]}</span>
                          <span className="stock-timeline-qty">{m.quantity} adet</span>
                        </div>
                        <div className="stock-timeline-name">{m.productName}</div>
                        <div className="stock-timeline-meta">
                          {m.previousStock} → {m.newStock} · {formatDateTime(m.createdAt)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
      </div>

      <footer className="stock-hero stock-hero--dock">
        <div className="stock-hero-card">
          <div className="stock-hero-layout">
            <section className="stock-hero-intro">
              <h1>Stok Yönetimi</h1>
              <p>
                {store.products.length} ürün · gerçek zamanlı stok takibi
                {store.products.length < EXPECTED_PRODUCT_COUNT && (
                  <span className="stock-warn"> (güncelleme gerekli: {EXPECTED_PRODUCT_COUNT})</span>
                )}
              </p>
              <span className="stock-version">Katalog {APP_CATALOG_VERSION}</span>
            </section>

            <section className="stock-hero-kpis" aria-label="Stok özet metrikleri">
              <button type="button" className="stock-kpi" onClick={() => applyFilter('all')}>
                <span className="stock-kpi-icon">📦</span>
                <div>
                  <span className="stock-kpi-label">Toplam Ürün</span>
                  <strong>{store.products.length}</strong>
                </div>
              </button>
              <button type="button" className="stock-kpi stock-kpi--green" onClick={() => applyFilter('all')}>
                <span className="stock-kpi-icon">📊</span>
                <div>
                  <span className="stock-kpi-label">Toplam Stok</span>
                  <strong>{store.totalStockUnits.toLocaleString('tr-TR')}</strong>
                </div>
              </button>
              <button
                type="button"
                className={`stock-kpi stock-kpi--warn ${filter === 'low' ? 'active' : ''}`}
                onClick={() => applyFilter('low')}
              >
                <span className="stock-kpi-icon">⚠️</span>
                <div>
                  <span className="stock-kpi-label">Az Stok ≤{store.lowStockThreshold}</span>
                  <strong>{store.lowStockCount}</strong>
                </div>
              </button>
              <button
                type="button"
                className={`stock-kpi stock-kpi--danger ${filter === 'out' ? 'active' : ''}`}
                onClick={() => applyFilter('out')}
              >
                <span className="stock-kpi-icon">🚫</span>
                <div>
                  <span className="stock-kpi-label">Tükenen</span>
                  <strong>{store.outOfStockCount}</strong>
                </div>
              </button>
            </section>

            <section className="stock-hero-health">
              <div
                className="stock-health-ring"
                style={{ '--health-pct': healthPercent } as CSSProperties}
                title="Stokta olan ürün oranı"
              >
                <span>{healthPercent}%</span>
              </div>
              <div className="stock-health-meta">
                <strong>Stok Sağlığı</strong>
                <span>{inStockCount} / {store.products.length} ürün stokta</span>
                <span className="stock-health-value">Envanter: {formatCurrency(inventoryValue)}</span>
              </div>
            </section>
          </div>
        </div>
      </footer>

      <ProductSetModal
        open={setModalOpen}
        products={store.products}
        productSets={store.productSets}
        onClose={() => setSetModalOpen(false)}
        onSave={(data) => {
          const saved = store.saveProductSet(data);
          if (saved) showToast(`Set kaydedildi: ${saved.name}`);
          return saved;
        }}
        onAssemble={(setId, quantity, note) => {
          const result = store.assembleProductSet(setId, quantity, note);
          if (result.ok) {
            showToast(`${quantity} adet set monte edildi`);
          }
          return result;
        }}
        onAdjustStock={(setId, delta, note) => {
          store.adjustProductSetStock(setId, delta, note);
          showToast('Set stoku güncellendi');
        }}
        onRemove={(setId) => {
          store.removeProductSet(setId);
          showToast('Set silindi');
        }}
      />

      <StockOperationsModal
        open={stockOpsOpen}
        products={store.products}
        productSets={store.productSets}
        lowStockThreshold={store.lowStockThreshold}
        initialProductId={stockOpsProductId}
        initialOperation={stockOpsMode}
        onClose={() => setStockOpsOpen(false)}
        onAdjust={handleStockAdjust}
        onSetStock={handleStockSet}
        onSaveSet={(data) => {
          const saved = store.saveProductSet(data);
          if (saved) showToast(`Set kaydedildi: ${saved.name}`);
          return saved;
        }}
        onAssembleSet={(setId, quantity, note) => {
          const result = store.assembleProductSet(setId, quantity, note);
          if (result.ok) showToast(`${quantity} adet set monte edildi`);
          return result;
        }}
        onAdjustSetStock={(setId, delta, note) => {
          store.adjustProductSetStock(setId, delta, note);
          showToast('Set stoku güncellendi');
        }}
        onRemoveSet={(setId) => {
          store.removeProductSet(setId);
          showToast('Set silindi');
        }}
        onUpdateBarcode={(productId, barcode) => {
          store.updateProductBarcode(productId, barcode);
          showToast('Barkod kaydedildi');
        }}
      />

      {bulkWholesaleOpen && (
        <div className="security-modal-overlay" role="dialog" aria-modal="true" onClick={() => setBulkWholesaleOpen(false)}>
          <div className="security-modal-card stock-modal stock-modal--wide" onClick={(event) => event.stopPropagation()}>
            <h2>Toplu Toptan Fiyat</h2>
            <p className="stock-modal-hint">
              Listelenen <strong>{filtered.length}</strong> ürün için toptan fiyatlar hesaplanır.
            </p>

            <div className="stock-bulk-base-grid">
              {(Object.keys(WHOLESALE_BASE_LABELS) as WholesalePriceBase[]).map((base) => {
                const isDisabled = DISABLED_WHOLESALE_BASES.includes(base);
                return (
                  <button
                    key={base}
                    type="button"
                    className={`stock-bulk-base-btn ${bulkWholesaleBase === base ? 'is-active' : ''} ${isDisabled ? 'is-disabled' : ''}`}
                    onClick={() => !isDisabled && setBulkWholesaleBase(base)}
                    disabled={isDisabled}
                    title={isDisabled ? 'Şu an kullanılamıyor' : undefined}
                  >
                    {WHOLESALE_BASE_LABELS[base]}
                  </button>
                );
              })}
            </div>

            <div className="stock-wholesale-grid">
              {WHOLESALE_QUANTITIES.map((qty) => {
                const key = `qty${qty}` as keyof typeof bulkWholesaleDiscounts;
                return (
                  <label key={qty} className="settings-field">
                    <span>{qty}+ adet indirim %</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={bulkWholesaleDiscounts[key]}
                      onChange={(event) => setBulkWholesaleDiscounts((prev) => ({
                        ...prev,
                        [key]: event.target.value,
                      }))}
                    />
                  </label>
                );
              })}
            </div>

            <p className="stock-modal-hint">
              Seçilen {WHOLESALE_BASE_LABELS[bulkWholesaleBase]} fiyatından indirim yüzdesi düşülerek
              10 / 20 / 50 / 100 adet toptan birim fiyatları oluşturulur.
            </p>

            <div className="security-modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => setBulkWholesaleOpen(false)}>İptal</button>
              <button type="button" className="btn btn-primary" onClick={applyBulkWholesale}>Uygula</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
