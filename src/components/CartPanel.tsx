import { useMemo, useState, type RefObject } from 'react';
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
import { getWholesaleTierLabel } from '../utils/wholesalePricing';
import type { PosNote } from '../types/business';
import { ProductImage } from './ProductImage';
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
  onBarcodeScanFeedback?: (result: BarcodeScanApplyResult) => void;
  /** POS Lite: kupon/puan kapalı, ödeme alanı kompakt */
  compactCheckout?: boolean;
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
  onBarcodeScanFeedback,
  compactCheckout = false,
}: CartPanelProps) {
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
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

  const showCrmCheckout =
    !compactCheckout && onCrmCouponChange && !samplesOnly;
  const crmHint = compactCheckout ? '' : crmDiscountLabel;

  return (
    <aside
      className={`cart-panel${compactCheckout ? ' cart-panel--compact-checkout' : ''}${hasCartItems ? ' cart-panel--has-items' : ''}`}
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
            onScanFeedback={onBarcodeScanFeedback}
          />
        </div>

        <div className="cart-panel-header-row">
          <div className="cart-panel-header-title">
            <h2>Sepet</h2>
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

        <div className="sale-customer-bar">
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

          <label className="sale-customer-field">
            <span>Müşteri adı</span>
            <input
              type="text"
              placeholder="Ad soyad (yeni kayıt veya arama)"
              value={saleCustomerName}
              onChange={(e) => onCustomerNameChange(e.target.value)}
            />
          </label>

          <div className="cart-panel-toolbar">
            <button
              type="button"
              className={`sale-customer-search-toggle ${customerSearchOpen ? 'is-open' : ''}`}
              onClick={() => setCustomerSearchOpen((open) => !open)}
            >
              {customerSearchOpen ? 'Müşteri aramasını kapat' : 'Kayıtlı müşteri ara'}
            </button>
          </div>

          {customerSearchOpen && (
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

          {statusMessage && (
            <div className={`sale-customer-status ${statusMessage.className} ${hasCartItems ? 'sale-customer-status--compact' : ''}`}>
              {statusMessage.text}
            </div>
          )}
        </div>
      </div>

      <div className={`cart-panel-items ${cart.length === 0 ? 'cart-panel-items--idle' : ''}`}>
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
            const lineTotal = item.unitPrice * item.quantity;
            const tierLabel = item.priceType === 'wholesale' ? getWholesaleTierLabel(item.quantity) : null;

            if (item.setId) {
              const set = getSet(item.setId);
              if (!set) return null;
              const coverProduct = products.find((p) => p.id === set.items[0]?.productId);
              return (
                <div key={`set-${item.setId}-${item.priceType}`} className="cart-item cart-item--set">
                  <div className="cart-item-info">
                    {coverProduct ? <ProductImage product={coverProduct} size="sm" /> : <div className="set-cart-thumb">🎁</div>}
                    <div>
                      <div className="cart-item-name">{set.name}</div>
                      <div className="cart-item-price">
                        {formatCurrency(item.unitPrice)}
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
                    <div className="cart-item-total">{formatCurrency(lineTotal)}</div>
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
                <div className="cart-item-info">
                  <ProductImage product={product} size="sm" />
                  <div>
                    <div className="cart-item-name">{product.name}</div>
                    <div className="cart-item-price">
                      {isSampleLine ? (
                        <span className="cart-item-price-free">Ücretsiz</span>
                      ) : (
                        formatCurrency(item.unitPrice)
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
                  <div className="cart-item-total">
                    {isSampleLine ? '—' : formatCurrency(lineTotal)}
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
          {showCrmCheckout && (
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
          )}
          {crmHint && <p className="cart-crm-hint">{crmHint}</p>}
          <div className="cart-total">
            <span>Toplam</span>
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

          {cashDayClosed && (
            <p className="cart-day-closed-warn" role="alert">Kasa günü kapalı — satış kapalı (Ayarlar’dan kuralı değiştirebilirsiniz).</p>
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
          {onParkSale && cart.length > 0 && (
            <button type="button" className="btn btn-outline btn-block cart-park-btn" onClick={onParkSale} disabled={checkoutBusy}>
              Beklet (F7)
            </button>
          )}
          <p className="cart-shortcut-hint">F8 — son bekleyen satışı geri çağır</p>
        </div>
      )}
    </aside>
  );
}
