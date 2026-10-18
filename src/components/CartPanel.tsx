import { useEffect, useMemo, useState, type RefObject } from 'react';
import type { Customer } from '../types/business';
import type { CartItem, PriceType, Product, SaleMode } from '../types/product';
import type { ProductSet } from '../types/productSet';
import type { SearchHint } from '../utils/productSearch';
import { PremiumProductSearch, type PremiumProductSearchHandle } from './PremiumProductSearch';
import type { BarcodeScanApplyResult } from '../utils/barcodeScan';
import {
  customerMatchesSearch,
  GREENLEAF_NO_PLACEHOLDER,
  isValidGreenleafNumber,
  normalizeGreenleafNumber,
} from '../utils/customerValidation';
import { formatCurrency } from '../utils/format';
import { SALE_PRICE_LABELS } from '../utils/salePricing';
import { DEFAULT_VAT_RATE, splitGrossAmount } from '../utils/vatAnalytics';
import { getWholesaleTierLabel } from '../utils/wholesalePricing';
import type { PosNote } from '../types/business';
import { CartIdleStage } from './CartIdleStage';

interface CartPanelProps {
  cart: CartItem[];
  products: Product[];
  productSets: ProductSet[];
  customers: Customer[];
  total: number;
  sampleCount: number;
  search: string;
  searchHints: SearchHint[];
  lowStockThreshold: number;
  saleMode: SaleMode;
  onSaleModeChange: (mode: SaleMode) => void;
  saleGreenleafNumber: string;
  saleCustomerId?: string;
  saleCustomerName: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onGreenleafChange: (value: string) => void;
  onCustomerNameChange: (value: string) => void;
  onSelectCustomer: (customerId: string | null) => void;
  onUpdateQuantity: (productId: number, priceType: PriceType, quantity: number) => void;
  onUpdateSetQuantity: (setId: string, priceType: PriceType, quantity: number) => void;
  onRemove: (productId: number, priceType: PriceType) => void;
  onRemoveSet: (setId: string, priceType: PriceType) => void;
  onClear: () => void;
  onCheckout: (method: 'cash' | 'card' | 'transfer' | 'credit' | 'split') => void;
  onParkSale?: () => void;
  checkoutBusy?: boolean;
  cashDayClosed?: boolean;
  crmCouponCode?: string;
  onCrmCouponChange?: (value: string) => void;
  crmPointsToRedeem?: number;
  onCrmPointsChange?: (value: number) => void;
  cartSubtotal?: number;
  crmDiscountLabel?: string;
  businessName: string;
  posNotes: PosNote[];
  posNotesDurationSec: number;
  posNotesRepeatIntervalMin: number;
  scanSearchRef?: RefObject<PremiumProductSearchHandle>;
  onBarcodeScan?: (normalized: string) => BarcodeScanApplyResult;
  onAddProductToCart?: (productId: number) => BarcodeScanApplyResult;
  onBarcodeScanFeedback?: (result: BarcodeScanApplyResult) => void;
  /** POS Lite: kupon/puan kapalı, ödeme alanı kompakt */
  compactCheckout?: boolean;
  hasHeldSales?: boolean;
  onRecallHeldSale?: () => void;
}

type CustomerStatus = 'registered' | 'new-registration' | 'gl-linked' | 'partner-only' | 'name-only' | 'none';

export function CartPanel({
  cart,
  products,
  productSets,
  customers,
  total,
  sampleCount,
  search,
  searchHints,
  lowStockThreshold,
  saleMode,
  onSaleModeChange,
  saleGreenleafNumber,
  saleCustomerId,
  saleCustomerName,
  onSearchChange,
  onSearchClear,
  onGreenleafChange,
  onCustomerNameChange,
  onSelectCustomer,
  onUpdateQuantity,
  onUpdateSetQuantity,
  onRemove,
  onRemoveSet,
  onClear,
  onCheckout,
  checkoutBusy = false,
  onParkSale,
  cashDayClosed = false,
  crmCouponCode = '',
  onCrmCouponChange,
  crmPointsToRedeem = 0,
  onCrmPointsChange,
  cartSubtotal,
  crmDiscountLabel,
  businessName,
  posNotes,
  posNotesDurationSec,
  posNotesRepeatIntervalMin,
  scanSearchRef,
  onBarcodeScan,
  onAddProductToCart,
  onBarcodeScanFeedback,
  compactCheckout = false,
  hasHeldSales = false,
  onRecallHeldSale,
}: CartPanelProps) {
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  /** Sepet doluysa ürün listesine yer açmak için müşteri alanını daralt */
  const [customerExtraOpen, setCustomerExtraOpen] = useState(true);
  const [crmOpen, setCrmOpen] = useState(false);
  const getProduct = (id: number) => products.find((p) => p.id === id);
  const getSet = (id: string) => productSets.find((set) => set.id === id);

  const selectedCustomer = saleCustomerId
    ? customers.find((c) => c.id === saleCustomerId)
    : undefined;

  const greenleafAccepted = normalizeGreenleafNumber(saleGreenleafNumber);
  const trimmedName = saleCustomerName.trim();

  const glMatchedCustomer = useMemo(() => {
    if (!greenleafAccepted) return undefined;
    return customers.find(
      (c) => normalizeGreenleafNumber(c.greenleafNumber ?? '') === greenleafAccepted,
    );
  }, [customers, greenleafAccepted]);

  const customerStatus: CustomerStatus = useMemo(() => {
    if (saleCustomerId && selectedCustomer) return 'registered';
    if (greenleafAccepted && glMatchedCustomer && !trimmedName) return 'gl-linked';
    if (greenleafAccepted && trimmedName) return 'new-registration';
    if (greenleafAccepted && !saleCustomerId) return 'partner-only';
    if (trimmedName) return 'name-only';
    return 'none';
  }, [saleCustomerId, selectedCustomer, greenleafAccepted, trimmedName, glMatchedCustomer]);

  const customerSuggestions = useMemo(() => {
    const q = customerQuery.trim();
    if (q.length < 1) return [];
    return customers.filter((c) => customerMatchesSearch(c, q)).slice(0, 8);
  }, [customers, customerQuery]);

  const partnerLocked = isValidGreenleafNumber(saleGreenleafNumber);

  const statusMessage = (() => {
    if (customerStatus === 'registered' && selectedCustomer) {
      return {
        className: 'sale-customer-status--registered',
        text: `Kayıtlı müşteri · ${selectedCustomer.name}${selectedCustomer.greenleafNumber ? ` · ${selectedCustomer.greenleafNumber}` : ''}`,
      };
    }
    if (customerStatus === 'new-registration') {
      return {
        className: 'sale-customer-status--new',
        text: 'Yeni müşteri — satış tamamlanınca otomatik kaydedilecek',
      };
    }
    if (customerStatus === 'gl-linked' && glMatchedCustomer) {
      return {
        className: 'sale-customer-status--registered',
        text: `Kayıtlı müşteri (GL) · ${glMatchedCustomer.name} — satış bu müşteriye kaydedilecek`,
      };
    }
    if (customerStatus === 'partner-only') {
      return {
        className: 'sale-customer-status--hint',
        text: 'Partner fiyatı — bu GL kayıtlı müşteri değil; yeni kayıt için ad girin',
      };
    }
    if (customerStatus === 'name-only') {
      return {
        className: 'sale-customer-status--hint',
        text: 'Greenleaf no girildiğinde partner fiyatı ve otomatik kayıt uygulanır',
      };
    }
    return null;
  })();

  const hasCartItems = cart.length > 0;
  const samplesOnly = hasCartItems && total === 0 && sampleCount > 0;
  const cartVatBreakdown = useMemo(() => {
    if (samplesOnly || total <= 0) return { netAmount: 0, vatAmount: 0, grossAmount: 0 };
    return splitGrossAmount(total, DEFAULT_VAT_RATE);
  }, [total, samplesOnly]);
  const cartFocusLayout = hasCartItems && !compactCheckout;
  const searchActive = search.trim().length > 0;
  const showCustomerExtra = compactCheckout || customerExtraOpen || !hasCartItems;
  /** Barkod/ürün araması yazılırken Greenleaf alanı gizlenir — liste için yer açılır */
  const showCustomerBar = compactCheckout || !searchActive;
  /** Sepet dolu: Greenleaf no alanı gizlenir (müşteri alanı ayrı açılır) */
  const showGreenleafField = showCustomerBar && !hasCartItems;

  useEffect(() => {
    if (cart.length === 0) {
      setCustomerExtraOpen(true);
    } else if (!compactCheckout) {
      setCustomerExtraOpen(false);
    }
  }, [cart.length, compactCheckout]);

  const cartLineCount = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity, 0),
    [cart],
  );

  const showCrmCheckout =
    !compactCheckout && onCrmCouponChange && !samplesOnly;
  const crmHint = compactCheckout ? '' : crmDiscountLabel;

  return (
    <aside
      className={`cart-panel${compactCheckout ? ' cart-panel--compact-checkout' : ''}${hasCartItems ? ' cart-panel--has-items' : ''}${cartFocusLayout ? ' cart-panel--cart-focus' : ''}${searchActive ? ' cart-panel--search-active' : ''}`}
    >
      <div className={`cart-panel-top ${hasCartItems ? 'cart-panel-top--compact' : ''}`}>
        <div className="cart-panel-search">
          <PremiumProductSearch
            ref={scanSearchRef}
            value={search}
            products={products}
            lowStockThreshold={lowStockThreshold}
            hints={searchHints}
            onChange={onSearchChange}
            onClear={onSearchClear}
            onBarcodeScan={onBarcodeScan}
            onAddProduct={onAddProductToCart}
            onScanFeedback={onBarcodeScanFeedback}
          />
        </div>

        <div className="cart-panel-header-row">
          <div className="cart-panel-header-title">
            <h2>
              Sepet
              {hasCartItems && (
                <span className="cart-panel-count" title="Sepet satırı / adet">
                  {cart.length} · {cartLineCount} adet
                </span>
              )}
            </h2>
            {hasCartItems && (
              <button
                type="button"
                className="cart-panel-header-clear"
                onClick={onClear}
                disabled={checkoutBusy}
              >
                Temizle
              </button>
            )}
          </div>
          <div className="cart-panel-header-actions">
            {partnerLocked && (
              <span className="cart-panel-partner-chip">Partner</span>
            )}
            <div className="sale-price-mode-toggle sale-price-mode-toggle--inline" role="group" aria-label="Satış fiyat modu">
              <button
                type="button"
                className={`sale-price-mode-btn ${saleMode === 'retail' ? 'is-active' : ''}`}
                onClick={() => onSaleModeChange('retail')}
              >
                {partnerLocked ? 'Partner' : 'Perakende'}
              </button>
              <button
                type="button"
                className={`sale-price-mode-btn ${saleMode === 'wholesale' ? 'is-active' : ''}`}
                onClick={() => onSaleModeChange('wholesale')}
              >
                Toptan
              </button>
            </div>
          </div>
        </div>

        {searchActive && !hasCartItems && saleGreenleafNumber.trim() && (
          <p className="cart-gl-active-pill" title="Greenleaf numarası kayıtlı — aramayı temizleyince alan geri gelir">
            GL {saleGreenleafNumber.trim()}
            {partnerLocked ? ' · Partner fiyat' : ''}
          </p>
        )}

        {showCustomerBar && (
        <div className={`sale-customer-bar ${cartFocusLayout && !showCustomerExtra ? 'sale-customer-bar--slim' : ''}${!showGreenleafField ? ' sale-customer-bar--no-gl' : ''}`}>
          {showGreenleafField && (
            <input
              type="text"
              className="sale-greenleaf-input"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              placeholder={GREENLEAF_NO_PLACEHOLDER}
              aria-label="Greenleaf numarası"
              value={saleGreenleafNumber}
              onChange={(e) => onGreenleafChange(e.target.value)}
            />
          )}

          {cartFocusLayout && (
            <button
              type="button"
              className="cart-customer-toggle"
              onClick={() => setCustomerExtraOpen((open) => !open)}
            >
              {showCustomerExtra ? 'Müşteri alanını gizle ▴' : 'Müşteri alanı ▾'}
            </button>
          )}

          {showCustomerExtra && (
          <label className="sale-customer-field">
            <span>Müşteri adı</span>
            <input
              type="text"
              placeholder="Ad soyad (yeni kayıt veya arama)"
              value={saleCustomerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
            />
          </label>
          )}

          {showCustomerExtra && (
          <div className="cart-panel-toolbar">
            <button
              type="button"
              className={`sale-customer-search-toggle ${customerSearchOpen ? 'is-open' : ''}`}
              onClick={() => setCustomerSearchOpen((open) => !open)}
            >
              {customerSearchOpen ? 'Müşteri aramasını kapat' : 'Kayıtlı müşteri ara'}
            </button>
          </div>
          )}

          {showCustomerExtra && customerSearchOpen && (
            <>
              <label className="sale-customer-field">
                <span>Kayıtlı müşteri ara</span>
                <input
                  type="search"
                  placeholder="Ad, telefon veya GL no..."
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                />
              </label>
              <ul className="sale-customer-suggestions">
                {customerQuery.trim().length < 1 ? (
                  <li className="sale-customer-suggestion-empty">Aramak için yazın</li>
                ) : customerSuggestions.length === 0 ? (
                  <li className="sale-customer-suggestion-empty">Kayıtlı müşteri bulunamadı</li>
                ) : (
                  customerSuggestions.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        className="sale-customer-suggestion"
                        onClick={() => {
                          onSelectCustomer(customer.id);
                          setCustomerQuery('');
                          setCustomerSearchOpen(false);
                        }}
                      >
                        <strong>{customer.name}</strong>
                        <span>
                          {customer.greenleafNumber ? `GL ${customer.greenleafNumber}` : 'Greenleaf no yok'}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}

          {showCustomerExtra && statusMessage && (
            <div className={`sale-customer-status ${statusMessage.className} ${hasCartItems ? 'sale-customer-status--compact' : ''}`}>
              {statusMessage.text}
            </div>
          )}
        </div>
        )}
      </div>

      <div
        className={`cart-panel-items ${cart.length === 0 ? 'cart-panel-items--idle' : ''}`}
        aria-label={hasCartItems ? `Sepet ürünleri, ${cart.length} satır` : undefined}
      >
        {cart.length === 0 ? (
          <div className="cart-panel-idle-wrap">
            <CartIdleStage
              businessName={businessName}
              notes={posNotes}
              displayDurationSec={posNotesDurationSec}
              repeatIntervalMin={posNotesRepeatIntervalMin}
            />
          </div>
        ) : (
          cart.map((item) => {
            const isSampleLine = item.priceType === 'sample';
            const lineGross = item.unitPrice * item.quantity;
            const lineVat = isSampleLine ? null : splitGrossAmount(lineGross, DEFAULT_VAT_RATE);
            const unitNet = lineVat ? lineVat.netAmount / item.quantity : 0;
            const tierLabel = item.priceType === 'wholesale' ? getWholesaleTierLabel(item.quantity) : null;

            if (item.setId) {
              const set = getSet(item.setId);
              if (!set) return null;
              return (
                <div key={`set-${item.setId}-${item.priceType}`} className="cart-item cart-item--set">
                  <div className="cart-item-info cart-item-info--no-thumb">
                    <div className="set-cart-thumb" aria-hidden>🎁</div>
                    <div>
                      <div className="cart-item-name">{set.name}</div>
                      <div className="cart-item-price">
                        <span className="cart-item-price-net">
                          {formatCurrency(lineVat ? lineVat.netAmount / item.quantity : item.unitPrice)}
                          <span className="cart-item-price-tag">KDV hariç</span>
                        </span>
                        <span className="cart-item-type">
                          Set · {SALE_PRICE_LABELS[item.priceType]}
                          {tierLabel ? ` · ${tierLabel}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="cart-item-controls">
                    <div className="qty-control">
                      <button
                        type="button"
                        onClick={() => onUpdateSetQuantity(item.setId!, item.priceType, item.quantity - 1)}
                        aria-label="Azalt"
                      >
                        −
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onUpdateSetQuantity(item.setId!, item.priceType, item.quantity + 1)}
                        aria-label="Artır"
                      >
                        +
                      </button>
                    </div>
                    <div className="cart-item-total cart-item-total--vat">
                      {lineVat && (
                        <span className="cart-item-vat-part">+KDV {formatCurrency(lineVat.vatAmount)}</span>
                      )}
                      <strong>{formatCurrency(lineGross)}</strong>
                    </div>
                    <button
                      type="button"
                      className="cart-item-remove"
                      onClick={() => onRemoveSet(item.setId!, item.priceType)}
                      aria-label="Kaldır"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            }

            const product = getProduct(item.productId!);
            if (!product) return null;

            return (
              <div key={`${item.productId}-${item.priceType}`} className={`cart-item ${isSampleLine ? 'cart-item--sample' : ''}`}>
                <div className="cart-item-info cart-item-info--no-thumb">
                  <div>
                    <div className="cart-item-name">{product.name}</div>
                    <div className="cart-item-price">
                      {isSampleLine ? (
                        <span className="cart-item-price-free">Ücretsiz</span>
                      ) : (
                        <span className="cart-item-price-net">
                          {formatCurrency(unitNet)}
                          <span className="cart-item-price-tag">KDV hariç</span>
                        </span>
                      )}
                      <span className={`cart-item-type ${isSampleLine ? 'cart-item-type--sample' : ''}`}>
                        {SALE_PRICE_LABELS[item.priceType]}
                        {tierLabel ? ` · ${tierLabel}` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="cart-item-controls">
                  <div className="qty-control">
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.productId!, item.priceType, item.quantity - 1)}
                      aria-label="Azalt"
                    >
                      −
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onUpdateQuantity(item.productId!, item.priceType, item.quantity + 1)}
                      aria-label="Artır"
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-item-total cart-item-total--vat">
                    {isSampleLine ? (
                      '—'
                    ) : lineVat ? (
                      <>
                        <span className="cart-item-vat-part">+KDV {formatCurrency(lineVat.vatAmount)}</span>
                        <strong>{formatCurrency(lineGross)}</strong>
                      </>
                    ) : (
                      formatCurrency(lineGross)
                    )}
                  </div>
                  <button
                    type="button"
                    className="cart-item-remove"
                    onClick={() => onRemove(item.productId!, item.priceType)}
                    aria-label="Kaldır"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {cart.length > 0 && (
        <div className={`cart-panel-footer ${sampleCount > 0 ? 'cart-panel-footer--has-sample' : ''}`}>
          <div className="cart-panel-footer-meta">
          {showCrmCheckout && (
            <div className="cart-crm-collapsible">
              <button
                type="button"
                className="cart-crm-toggle"
                aria-expanded={crmOpen}
                onClick={() => setCrmOpen((open) => !open)}
              >
                <span>Kupon / puan</span>
                <span className="cart-crm-toggle-meta">
                  {(crmCouponCode?.trim() || (crmPointsToRedeem ?? 0) > 0) ? ' · girildi' : ''}
                  {crmOpen ? ' ▴' : ' ▾'}
                </span>
              </button>
              {crmOpen && (
                <>
                  <div className="cart-crm-row">
                    <input
                      className="cart-crm-input"
                      placeholder="Kupon kodu"
                      value={crmCouponCode}
                      onChange={(e) => onCrmCouponChange!(e.target.value.toUpperCase())}
                    />
                    {onCrmPointsChange && (
                      <input
                        className="cart-crm-input cart-crm-input--points"
                        type="number"
                        min={0}
                        placeholder="Puan kullan"
                        value={crmPointsToRedeem || ''}
                        onChange={(e) => onCrmPointsChange(parseInt(e.target.value, 10) || 0)}
                      />
                    )}
                  </div>
                  {crmHint && <p className="cart-crm-hint">{crmHint}</p>}
                </>
              )}
            </div>
          )}
          {!samplesOnly && total > 0 && (
            <div className="cart-vat-summary" aria-label="KDV dökümü">
              <div className="cart-vat-row">
                <span>Ara toplam (KDV hariç)</span>
                <span>{formatCurrency(cartVatBreakdown.netAmount)}</span>
              </div>
              <div className="cart-vat-row">
                <span>KDV (%{DEFAULT_VAT_RATE})</span>
                <span>{formatCurrency(cartVatBreakdown.vatAmount)}</span>
              </div>
            </div>
          )}

          {cashDayClosed && (
            <p className="cart-day-closed-warn" role="alert">Kasa günü kapalı — satış kapalı (Ayarlar’dan kuralı değiştirebilirsiniz).</p>
          )}
          </div>

          <div className="cart-panel-footer-pay">
          <div className="cart-total">
            <span>Toplam (KDV dahil)</span>
            <strong>{samplesOnly ? 'Ücretsiz' : formatCurrency(total)}</strong>
            {!samplesOnly && cartSubtotal != null && cartSubtotal > total && (
              <small className="cart-subtotal-struck">{formatCurrency(cartSubtotal)}</small>
            )}
          </div>
          {sampleCount > 0 && (
            <p className="cart-sample-summary">
              🎁 {sampleCount} adet numune ücretsiz
              {!samplesOnly && ' · satış stokundan düşmez'}
            </p>
          )}
          {compactCheckout && (
            <div className="cart-payment-toolbar">
              <button
                type="button"
                className="cart-footer-clear"
                onClick={onClear}
                disabled={checkoutBusy}
              >
                Temizle
              </button>
            </div>
          )}
          <div className="payment-buttons payment-buttons--pos">
            <button type="button" className="btn btn-payment cash" onClick={() => onCheckout('cash')} disabled={checkoutBusy || cashDayClosed}>
              {checkoutBusy ? '⏳...' : samplesOnly ? '🎁 Numune' : '💵 Nakit F1'}
            </button>
            {!samplesOnly && (
              <>
                <button type="button" className="btn btn-payment card" onClick={() => onCheckout('card')} disabled={checkoutBusy || cashDayClosed}>
                  {checkoutBusy ? '⏳...' : '💳 Kart F2'}
                </button>
                <button type="button" className="btn btn-payment transfer" onClick={() => onCheckout('transfer')} disabled={checkoutBusy || cashDayClosed}>
                  {checkoutBusy ? '⏳...' : '🏦 Havale F3'}
                </button>
                <button type="button" className="btn btn-payment credit" onClick={() => onCheckout('credit')} disabled={checkoutBusy || cashDayClosed}>
                  {checkoutBusy ? '⏳...' : '📝 Veresiye F4'}
                </button>
                <button type="button" className="btn btn-payment split" onClick={() => onCheckout('split')} disabled={checkoutBusy || cashDayClosed}>
                  Nakit+Kart F6
                </button>
              </>
            )}
          </div>
          <div className="cart-footer-actions">
            {onParkSale && (
              <button
                type="button"
                className="btn btn-outline cart-park-btn"
                onClick={onParkSale}
                disabled={checkoutBusy}
              >
                Beklet F7
              </button>
            )}
            {onRecallHeldSale && (
              <button
                type="button"
                className="btn btn-outline cart-recall-btn"
                onClick={onRecallHeldSale}
                disabled={checkoutBusy || !hasHeldSales}
                title={hasHeldSales ? 'Son bekleyen satışı sepete yükle' : 'Bekleyen satış yok'}
              >
                ↩ Bekleyen F8
              </button>
            )}
          </div>
          </div>
        </div>
      )}
    </aside>
  );
}
