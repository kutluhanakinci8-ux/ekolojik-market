import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Store } from '../store/useStore';
import { buildReceiptFromCart, printThermalReceipt } from '../utils/receiptPrint';
import { DEFAULT_POS_CHECKOUT_SETTINGS, type CompleteSaleOptions } from '../types/pos';
import { tryFiscalReceipt } from '../utils/posFiscalCheckout';
import { PosPaymentModal } from './pos/PosPaymentModal';
import { PosHeldSalesBar } from './pos/PosHeldSalesBar';
import { SaleReturnModal } from './SaleReturnModal';
import { formatBusinessBrand, formatCurrency, formatDateTime } from '../utils/format';
import {
  getActiveSearchHints,
  parseProductSearch,
  searchProducts,
  searchProductSets,
  type StockSearchFilter,
} from '../utils/productSearch';
import { ProductCard } from './ProductCard';
import { SetCard } from './SetCard';
import { CartPanel } from './CartPanel';
import type { PremiumProductSearchHandle } from './PremiumProductSearch';
import { usePosBarcodeWedge } from '../hooks/usePosBarcodeWedge';
import type { BarcodeScanApplyResult } from '../utils/barcodeScan';
import { playBarcodeErrorTone, playBarcodeSuccessTone } from '../utils/barcodeFeedback';
import { isPosLiteProfile } from '../utils/tenantProductProfile';
import {
  categoriesForTenantSales,
  isTenantCatalogIsolated,
  resolveEffectiveTenantId,
} from '../utils/tenantCatalogIsolation';

interface SalesScreenProps {
  store: Store;
}

export function SalesScreen({ store }: SalesScreenProps) {
<<<<<<< HEAD
  const posLiteCheckout = isPosLiteProfile(store.settings)
    || isTenantCatalogIsolated(resolveEffectiveTenantId(), store.settings);
=======
  const posLiteCheckout = isPosLiteProfile(store.settings);
>>>>>>> 1f0d661 (feat(pos-lite): sepette kampanya kaldır, kompakt ödeme ve daha fazla satır)
  const posCheckout = useMemo(
    () => ({ ...DEFAULT_POS_CHECKOUT_SETTINGS, ...store.settings.posCheckout }),
    [store.settings.posCheckout],
  );
  const PAGE_SIZE = posCheckout.productGridPageSize;
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState<StockSearchFilter>('all');
  const [page, setPage] = useState(0);
  const [lastSale, setLastSale] = useState<string | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [scanFlash, setScanFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [paymentModal, setPaymentModal] = useState<'cash' | 'split' | null>(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const hideProductGrid = posCheckout.hideGridWhenSearching && Boolean(search.trim());
  const scanSearchRef = useRef<PremiumProductSearchHandle>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const focusBarcodeInput = useCallback(() => {
    scanSearchRef.current?.focus();
  }, []);

  const handleBarcodeScan = useCallback((normalized: string): BarcodeScanApplyResult => {
    const now = Date.now();
    if (lastScanRef.current.code === normalized && now - lastScanRef.current.at < 400) {
      return { ok: true, kind: 'product', label: '' };
    }
    lastScanRef.current = { code: normalized, at: now };

    const result = store.scanAddToCart(normalized);
    if (result.ok && result.label) {
      playBarcodeSuccessTone();
      setScanFlash({ ok: true, text: `+ ${result.label}` });
      setSearch('');
      setPage(0);
    } else if (!result.ok) {
      playBarcodeErrorTone();
      setScanFlash({ ok: false, text: result.message });
    }
    window.setTimeout(() => setScanFlash(null), result.ok ? 1200 : 2800);
    return result;
  }, [store]);

  const onBarcodeScanFeedback = useCallback((result: BarcodeScanApplyResult) => {
    if (result.ok) {
      setSearch('');
      setPage(0);
    }
  }, []);

  usePosBarcodeWedge(true, (code) => {
    const result = handleBarcodeScan(code);
    if (result.ok) {
      focusBarcodeInput();
    }
  });

  useEffect(() => {
    focusBarcodeInput();
  }, [focusBarcodeInput]);

  const parsedSearch = useMemo(() => parseProductSearch(search), [search]);

  const activeSets = useMemo(
    () => store.productSets.filter((set) => set.isActive),
    [store.productSets],
  );

  const effectiveCategory = category === 'all' && parsedSearch.categoryId
    ? parsedSearch.categoryId
    : category;

  const effectiveStockFilter = stockFilter !== 'all'
    ? stockFilter
    : parsedSearch.stockFilter;

  const showingSets = effectiveCategory === 'setler' || parsedSearch.showSets;

  const filteredProducts = useMemo(() => {
    if (showingSets) return [];
    return searchProducts(store.products, search, {
      lowStockThreshold: store.lowStockThreshold,
      categoryId: effectiveCategory,
      stockFilter: effectiveStockFilter,
    }).map((result) => result.product);
  }, [store.products, search, effectiveCategory, effectiveStockFilter, store.lowStockThreshold, showingSets]);

  const filteredSets = useMemo(() => {
    if (!showingSets && !parsedSearch.showSets && effectiveCategory !== 'setler') {
      if (!search.trim().toLowerCase().includes('set')) return [];
    }
    return searchProductSets(activeSets, search, { onlyWhenRequested: effectiveCategory !== 'setler' });
  }, [activeSets, search, showingSets, parsedSearch.showSets, effectiveCategory]);

  const displaySets = showingSets || (effectiveCategory === 'all' && parsedSearch.showSets);
  const gridCount = displaySets ? filteredSets.length : filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(gridCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedProducts = filteredProducts.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const pagedSets = filteredSets.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const searchHints = useMemo(
    () => getActiveSearchHints(search, effectiveCategory, effectiveStockFilter),
    [search, effectiveCategory, effectiveStockFilter],
  );

  const crmDiscountLabel = useMemo(() => {
    const p = store.cartCheckoutPreview;
    const parts: string[] = [];
    if (p.campaignDiscount > 0) parts.push(`Kampanya −${formatCurrency(p.campaignDiscount)}`);
    if (p.couponDiscount > 0) parts.push(`Kupon −${formatCurrency(p.couponDiscount)}`);
    if (p.loyaltyDiscount > 0) parts.push(`Puan −${formatCurrency(p.loyaltyDiscount)}`);
    if (p.pointsToEarn > 0) parts.push(`+${p.pointsToEarn} puan`);
    return parts.length ? parts.join(' · ') : '';
  }, [store.cartCheckoutPreview, store.cart, store.saleCouponCode, store.saleLoyaltyPointsToRedeem]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: store.products.length };
    for (const p of store.products) {
      counts[p.category] = (counts[p.category] ?? 0) + 1;
    }
    counts.setler = activeSets.length;
    return counts;
  }, [store.products, activeSets.length]);

  const salesCategories = useMemo(
    () => categoriesForTenantSales(store.products, activeSets.length, posLiteCheckout),
    [store.products, activeSets.length, posLiteCheckout],
  );

  const lastTodaySale = store.todaySales[0];

  const finalizeSale = useCallback(async (
    method: 'cash' | 'card' | 'transfer' | 'credit' | 'split',
    options?: CompleteSaleOptions,
  ) => {
    if (store.cart.length === 0 || checkoutBusy) return;
    if (method === 'credit' && !store.saleCustomerId && !store.saleCustomerName.trim()) {
      setLastSale('Veresiye için müşteri seçin veya ad girin');
      setTimeout(() => setLastSale(null), 4000);
      return;
    }
    setCheckoutBusy(true);
    setPaymentModal(null);

    const cartSnapshot = [...store.cart];
    const paidItems = cartSnapshot.filter((item) => item.priceType !== 'sample');
    const sampleCount = store.cartSampleCount;
    const total = store.cartTotal;
    const samplesOnly = paidItems.length === 0 && sampleCount > 0;

    let receiptNo: string | undefined;
    let fiscalPrinted = false;
    const fiscalMethod = method === 'split' ? 'split' : method;

    const runFiscal = !samplesOnly && method !== 'credit';
    if (runFiscal && posCheckout.fiscalTiming === 'before_sale') {
      const fiscal = await tryFiscalReceipt(
        paidItems,
        store.products,
        store.productSets,
        fiscalMethod,
        total,
        posCheckout,
      );
      if (fiscal.cancelled) {
        setCheckoutBusy(false);
        return;
      }
      receiptNo = fiscal.receiptNo;
      fiscalPrinted = fiscal.fiscalPrinted;
    }

    const sale = store.completeSale(method, options);
    if (!sale) {
      setLastSale(
        store.checkoutError
          ?? (method === 'credit'
            ? 'Veresiye kaydedilemedi — müşteri seçin veya Greenleaf no girin'
            : 'Satış kaydedilemedi — müşteri bilgisini kontrol edin'),
      );
      setTimeout(() => setLastSale(null), 5000);
      setCheckoutBusy(false);
      return;
    }

    if (runFiscal && posCheckout.fiscalTiming === 'after_sale') {
      const fiscal = await tryFiscalReceipt(
        paidItems,
        store.products,
        store.productSets,
        fiscalMethod,
        sale.total,
        posCheckout,
      );
      if (!fiscal.cancelled) {
        receiptNo = fiscal.receiptNo ?? receiptNo;
        fiscalPrinted = fiscal.fiscalPrinted || fiscalPrinted;
      }
    }

    const receiptPayment = method === 'split' ? 'card' : method;
    if (!samplesOnly && method !== 'credit' && !fiscalPrinted) {
      const receiptData = buildReceiptFromCart(
        paidItems,
        store.products,
        receiptPayment,
        sale.total,
        store.settings.businessName,
        { receiptNo, saleId: sale.id, createdAt: new Date(sale.createdAt) },
        store.productSets,
      );
      await printThermalReceipt(receiptData);
    }

    const methodLabel = samplesOnly
      ? 'Numune'
      : method === 'cash' ? 'Nakit'
        : method === 'card' ? 'Kart'
          : method === 'credit' ? 'Veresiye'
            : method === 'split' ? 'Bölünmüş'
              : 'Havale';
    const changeMsg = sale.changeGiven != null && sale.changeGiven > 0
      ? ` · Para üstü ${formatCurrency(sale.changeGiven)}`
      : '';
    const fiscalMsg = receiptNo ? ` · Fiş: ${receiptNo}` : fiscalPrinted ? '' : samplesOnly ? '' : ' · Fiş yazdırıldı';
    const sampleMsg = sampleCount > 0 ? ` · ${sampleCount} numune` : '';
    const amountMsg = samplesOnly ? `${sampleCount} adet numune verildi` : `${formatCurrency(sale.total)} satış`;
    setLastSale(`${methodLabel} ile ${amountMsg}${sampleMsg}${changeMsg}${fiscalMsg}`);
    setTimeout(() => setLastSale(null), 5000);

    setCheckoutBusy(false);
    focusBarcodeInput();
  }, [checkoutBusy, focusBarcodeInput, posCheckout, store]);

  const handleCheckout = useCallback((method: 'cash' | 'card' | 'transfer' | 'credit' | 'split') => {
    if (method === 'cash') {
      setPaymentModal('cash');
      return;
    }
    if (method === 'split') {
      setPaymentModal('split');
      return;
    }
    void finalizeSale(method);
  }, [finalizeSale]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (paymentModal) return;
      const target = event.target as HTMLElement | null;
      if (target instanceof HTMLInputElement && !target.dataset.posScan && target.type !== 'button') {
        return;
      }
      switch (event.key) {
        case 'F1':
          event.preventDefault();
          if (store.cart.length > 0) setPaymentModal('cash');
          break;
        case 'F2':
          event.preventDefault();
          void finalizeSale('card');
          break;
        case 'F3':
          event.preventDefault();
          void finalizeSale('transfer');
          break;
        case 'F4':
          event.preventDefault();
          void finalizeSale('credit');
          break;
        case 'F6':
          event.preventDefault();
          if (store.cart.length > 0) setPaymentModal('split');
          break;
        case 'F7':
          event.preventDefault();
          if (store.cart.length > 0) {
            store.parkCurrentSale();
            focusBarcodeInput();
          }
          break;
        case 'F8':
          event.preventDefault();
          if (store.heldPosSales[0]) {
            store.recallHeldSale(store.heldPosSales[0].id);
            focusBarcodeInput();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [finalizeSale, focusBarcodeInput, paymentModal, store]);

  const changeCategory = (id: string) => {
    setCategory(id);
    setPage(0);
  };

  const changeStockFilter = (next: StockSearchFilter) => {
    setStockFilter(next);
    setPage(0);
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(0);
    const parsed = parseProductSearch(value);
    if (parsed.categoryId === 'setler') {
      setCategory('setler');
    }
  };

  const clearSearch = () => {
    setSearch('');
    setStockFilter('all');
    setPage(0);
  };

  return (
    <div className="sales-screen">
      {lastSale && (
        <div className="sale-toast" role="status">
          ✓ {lastSale}
        </div>
      )}
      {scanFlash && (
        <div
          className={`sale-toast sale-toast--scan ${scanFlash.ok ? 'sale-toast--scan-ok' : 'sale-toast--scan-err'}`}
          role="status"
        >
          {scanFlash.ok ? '✓' : '⚠'} {scanFlash.text}
        </div>
      )}

      <PosHeldSalesBar store={store} onRecalled={focusBarcodeInput} />

      {lastTodaySale && (
        <div className="sales-quick-return">
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setReturnModalOpen(true)}>
            Son satış iade ↩
          </button>
          <span>{formatCurrency(lastTodaySale.total)} · {formatDateTime(lastTodaySale.createdAt)}</span>
        </div>
      )}

      <div className="sales-body">
        <main className={`product-grid-area ${hideProductGrid ? 'product-grid-area--scan-focus' : ''}`}>
          {!hideProductGrid && (
          <div className="product-grid-header">
            <div className="product-grid-meta">
              <span>
                {displaySets ? `${filteredSets.length} set` : `${filteredProducts.length} ürün`}
              </span>
              {search.trim() && (
                <span className="premium-search-result-chip">
                  Arama: {search.trim()}
                </span>
              )}
              {store.cartSampleCount > 0 && (
                <span className="cart-count-badge cart-count-badge--sample">{store.cartSampleCount} numune</span>
              )}
              {store.cartItemCount > 0 && (
                <span className="cart-count-badge">{store.cartItemCount} adet sepette</span>
              )}
            </div>

            <div className="product-grid-categories">
              {salesCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`category-chip ${effectiveCategory === cat.id ? 'active' : ''}`}
                  onClick={() => changeCategory(cat.id)}
                >
                  {cat.label}
                  <span className="category-count">{categoryCounts[cat.id] ?? 0}</span>
                </button>
              ))}
            </div>

            <div className="sales-stock-filters" role="group" aria-label="Stok filtresi">
              <button
                type="button"
                className={`sales-stock-filter ${effectiveStockFilter === 'all' ? 'active' : ''}`}
                onClick={() => changeStockFilter('all')}
              >
                Tümü
              </button>
              <button
                type="button"
                className={`sales-stock-filter ${effectiveStockFilter === 'low' ? 'active' : ''}`}
                onClick={() => changeStockFilter('low')}
              >
                Az Stok
              </button>
              <button
                type="button"
                className={`sales-stock-filter ${effectiveStockFilter === 'out' ? 'active' : ''}`}
                onClick={() => changeStockFilter('out')}
              >
                Tükenen
              </button>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <button type="button" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>
                  ‹
                </button>
                <span>{safePage + 1} / {totalPages}</span>
                <button type="button" disabled={safePage >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  ›
                </button>
              </div>
            )}
          </div>
          )}

          {hideProductGrid && (
            <p className="sales-scan-focus-hint">Barkod modu — ürün listesi gizli. Listeyi görmek için aramayı temizleyin.</p>
          )}

          {!hideProductGrid && (
          <div className="product-grid market-grid">
            {displaySets
              ? pagedSets.map((set) => (
                <SetCard
                  key={set.id}
                  set={set}
                  products={store.products}
                  greenleafNumber={store.saleGreenleafNumber}
                  saleMode={store.saleMode}
                  onAdd={store.addSetToCart}
                />
              ))
              : pagedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  greenleafNumber={store.saleGreenleafNumber}
                  saleMode={store.saleMode}
                  lowStockThreshold={store.lowStockThreshold}
                  onAdd={store.addToCart}
                  onAddSample={store.addSampleToCart}
                />
              ))}
          </div>
          )}

          {!hideProductGrid && gridCount === 0 && (
            <div className="no-results">
              <p>
                {search.trim()
                  ? `"${search.trim()}" için sonuç bulunamadı`
                  : effectiveCategory === 'setler'
                    ? 'Set bulunamadı'
                    : 'Bu kategoride ürün bulunamadı'}
              </p>
              <p className="no-results-hint">
                Marka (ilife, carich), kategori (temizlik), stok durumu (az stok, tükenen) veya ürün adı ile arayın.
              </p>
            </div>
          )}
        </main>

        <aside className="sales-sidebar">
          <CartPanel
            cart={store.cart}
            products={store.products}
            productSets={store.productSets}
            customers={store.customers}
            total={store.cartTotal}
            sampleCount={store.cartSampleCount}
            search={search}
            searchHints={searchHints}
            lowStockThreshold={store.lowStockThreshold}
            saleMode={store.saleMode}
            onSaleModeChange={store.setSaleMode}
            saleGreenleafNumber={store.saleGreenleafNumber}
            saleCustomerId={store.saleCustomerId}
            saleCustomerName={store.saleCustomerName}
            onSearchChange={handleSearchChange}
            onSearchClear={clearSearch}
            onGreenleafChange={store.updateSaleGreenleafNumber}
            onCustomerNameChange={store.updateSaleCustomerName}
            onSelectCustomer={store.selectSaleCustomer}
            onUpdateQuantity={store.updateCartQuantity}
            onUpdateSetQuantity={store.updateSetCartQuantity}
            onRemove={store.removeFromCart}
            onRemoveSet={store.removeSetFromCart}
            onClear={store.clearCart}
            onCheckout={handleCheckout}
            onParkSale={() => store.parkCurrentSale()}
            checkoutBusy={checkoutBusy}
            cashDayClosed={store.isCashDayClosed && (posCheckout.blockSalesWhenDayClosed ?? true)}
            crmCouponCode={posLiteCheckout ? '' : store.saleCouponCode}
            onCrmCouponChange={posLiteCheckout ? undefined : store.setSaleCouponCode}
            crmPointsToRedeem={posLiteCheckout ? 0 : store.saleLoyaltyPointsToRedeem}
            onCrmPointsChange={posLiteCheckout ? undefined : store.setSaleLoyaltyPointsToRedeem}
            cartSubtotal={posLiteCheckout ? undefined : store.cartSubtotal}
            crmDiscountLabel={posLiteCheckout ? '' : crmDiscountLabel}
            compactCheckout={posLiteCheckout}
            businessName={formatBusinessBrand(store.settings.businessName)}
            posNotes={store.settings.posNotes.items}
            posNotesDurationSec={store.settings.posNotes.displayDurationSec}
            posNotesRepeatIntervalMin={store.settings.posNotes.repeatIntervalMin}
            scanSearchRef={scanSearchRef}
            onBarcodeScan={handleBarcodeScan}
            onBarcodeScanFeedback={onBarcodeScanFeedback}
          />
        </aside>
      </div>

      <PosPaymentModal
        open={paymentModal !== null}
        mode={paymentModal}
        total={store.cartTotal}
        onClose={() => setPaymentModal(null)}
        onConfirmCash={(tender) => { void finalizeSale('cash', { cashTendered: tender }); }}
        onConfirmSplit={(splits) => { void finalizeSale('split', { paymentSplits: splits }); }}
      />

      <SaleReturnModal
        open={returnModalOpen}
        sale={lastTodaySale ?? null}
        products={store.products}
        productSets={store.productSets}
        saleReturns={store.saleReturns}
        onClose={() => setReturnModalOpen(false)}
        onConfirm={async (saleId, lines, refundMethod, reason, note) => {
          const result = store.processSaleReturn(saleId, lines, refundMethod, reason, note);
          if (!result.ok) {
            setLastSale(result.message ?? 'İade yapılamadı');
          } else {
            setLastSale('İade kaydedildi');
          }
          setReturnModalOpen(false);
          setTimeout(() => setLastSale(null), 4000);
          return result;
        }}
      />
    </div>
  );
}
