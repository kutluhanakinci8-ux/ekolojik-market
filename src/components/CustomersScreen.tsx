import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Store } from '../store/useStore';
import type { Customer, CustomerType, IdentityDocumentCountry } from '../types/business';
import { CUSTOMER_TYPE_LABELS } from '../types/business';
import type { IdentityFormatCountry } from '../data/identityDocumentCountries';
import {
  formatIdentityCountryNameInput,
  getIdentityCountryDisplayLabel,
  resolveIdentityFormatCountryFromName,
} from '../data/identityDocumentCountries';
import { IdentityCountryAutocomplete } from './IdentityCountryAutocomplete';
import { StructuredLocationAutocomplete } from './StructuredLocationAutocomplete';
import { CustomerPhoneInput } from './CustomerPhoneInput';
import {
  formatStructuredLocationInput,
  resolveStructuredAddressCountryFromForm,
  resolveStructuredDistrict,
  type StructuredAddressCountry,
} from '../utils/structuredAddressLocation';
import { normalizePhoneForCountry } from '../utils/phoneNumberFormat';
import type { Product } from '../types/product';
import { getCustomerPurchaseSummary, getCustomerSaleCount } from '../utils/analytics';
import {
  CASHIER_PRIVACY_NOTICE,
  customerMatchesCashierSearch,
  displayCustomerName,
  getCustomerIdsInCashierWindow,
  getMaskedCustomerInitials,
  isCashierSession,
} from '../utils/cashierPrivacy';
import { formatReturnReceiptToastMessage, printSaleReturnReceipt } from '../utils/returnReceiptPrint';
import { canReturnSale, getSaleNetTotal, getSaleStatus } from '../utils/saleReturn';
import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import { SaleReturnModal } from './SaleReturnModal';
import {
  customerMatchesSearch,
  formatGreenleafNumber,
  formatTaxNumber,
  GREENLEAF_NO_HINT,
  GREENLEAF_NO_PLACEHOLDER,
  getIdentityDocumentHintForFormat,
  getIdentityDocumentMaxLength,
  isGreenleafInputComplete,
  isIdentityDocumentNumericInput,
  resolveIdentityFormatCountry,
  parseGreenleafNumberInput,
  parseCustomerNameInput,
  parseIdentityDocumentInput,
  parseSponsorNameInput,
  shouldAutoFocusAddressAfterIdentity,
  validateCustomerInput,
} from '../utils/customerValidation';
import { formatCurrency, formatDateTime } from '../utils/format';
import {
  buildCustomerStatement,
  getCustomerBalance,
  getCustomerLedgerTotals,
  type LedgerDebitCreditTotals,
} from '../utils/accountingAnalytics';
import type { CustomerLedgerEntry } from '../types/accounting';
import { ProductImage } from './ProductImage';
import { CustomerCrmSection } from './crm/CustomerCrmSection';
import { CrmCenterPanel } from './crm/CrmCenterPanel';

interface CustomersScreenProps {
  store: Store;
  /** Muhasebe alt sekmesi olarak gösterildiğinde üst başlık sadeleştirilir */
  embedded?: boolean;
}

const PAYMENT_LABELS = { cash: 'Nakit', card: 'Kart', transfer: 'Havale', credit: 'Veresiye', split: 'Bölünmüş' };

const SALE_STATUS_LABELS = {
  completed: 'Tamamlandı',
  partially_returned: 'Kısmi iade',
  fully_returned: 'İade edildi',
};

const EMPTY_FORM = {
  type: 'individual' as CustomerType,
  name: '',
  greenleafNumber: '',
  sponsorName: '',
  sponsorGreenleafNumber: '',
  taxNumber: '',
  identityDocumentCountry: 'TR' as IdentityDocumentCountry | undefined,
  identityDocumentCountryName: 'TÜRKİYE',
  taxOffice: '',
  address: '',
  city: '',
  district: '',
  postalCode: '',
  country: 'TÜRKİYE',
  phone: '',
  email: '',
  notes: '',
};

type FormMode = 'new' | 'edit' | null;

function getCustomerLedgerBalance(customerId: string, ledger: Store['customerLedger']): number {
  const entries = ledger.filter((entry) => entry.customerId === customerId);
  return getCustomerBalance(entries);
}

function getCustomerLedgerTotalsForId(
  customerId: string,
  ledger: Store['customerLedger'],
): LedgerDebitCreditTotals {
  const entries = ledger.filter((entry) => entry.customerId === customerId);
  return getCustomerLedgerTotals(entries);
}

function formatLedgerColumnAmount(value: number): string {
  return value > 0 ? formatCurrency(value) : '—';
}

function formatLedgerBalanceDisplay(balance: number): { label: string; className: string } {
  if (balance > 0) {
    return { label: formatCurrency(balance), className: 'customer-balance--debt' };
  }
  if (balance < 0) {
    return { label: formatCurrency(balance), className: 'customer-balance--overpaid' };
  }
  return { label: formatCurrency(0), className: 'customer-balance--clear' };
}

function getCustomerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getProductById(products: Product[], productId: number): Product | undefined {
  return products.find((p) => p.id === productId);
}

function CustomerProductCard({
  product,
  quantity,
  total,
  totalCost,
  totalProfit,
  showCostProfit,
}: {
  product?: Product;
  quantity: number;
  total: number;
  totalCost: number;
  totalProfit: number;
  showCostProfit: boolean;
}) {
  const name = product?.name ?? 'Ürün';

  return (
    <li className="customer-product-card">
      <div className="customer-product-card-image">
        {product ? (
          <ProductImage product={product} size="sm" />
        ) : (
          <div className="customer-product-card-placeholder" aria-hidden>📦</div>
        )}
      </div>
      <div className="customer-product-card-body">
        <strong className="customer-product-card-name">{name}</strong>
        <span className="customer-product-card-meta">{quantity} adet</span>
        {showCostProfit && (
          <span className="customer-product-card-finance">
            Maliyet {formatCurrency(totalCost)} · Kar {formatCurrency(totalProfit)}
          </span>
        )}
      </div>
      <div className="customer-product-card-total">{formatCurrency(total)}</div>
    </li>
  );
}

function CustomerDetailPanel({
  customer,
  summary,
  products,
  saleReturns,
  showCostProfit,
  ledgerBalance,
  customerLedger,
  store,
  onEdit,
  onDelete,
  onClose,
  onReturnSale,
}: {
  customer: Customer;
  summary: ReturnType<typeof getCustomerPurchaseSummary>;
  products: Product[];
  saleReturns: SaleReturn[];
  showCostProfit: boolean;
  ledgerBalance: number;
  customerLedger: CustomerLedgerEntry[];
  store: Store;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onReturnSale: (sale: Sale) => void;
}) {
  const balanceDisplay = formatLedgerBalanceDisplay(ledgerBalance);
  const ledgerTotals = useMemo(
    () => getCustomerLedgerTotals(customerLedger.filter((entry) => entry.customerId === customer.id)),
    [customer.id, customerLedger],
  );
  const statement = useMemo(
    () => buildCustomerStatement(customer.id, customerLedger),
    [customer.id, customerLedger],
  );
  return (
    <div className="customer-detail-panel customer-detail-panel--premium">
      <div className="customer-detail-toolbar">
        <button type="button" className="customer-detail-back" onClick={onClose}>
          ← Listeye Dön
        </button>
        <div className="customer-detail-toolbar-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onEdit}>
            Düzenle
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onDelete}>
            Sil
          </button>
        </div>
      </div>

      <div className="customer-detail-profile">
        <div className="customer-premium-avatar customer-premium-avatar--lg" aria-hidden="true">
          {getCustomerInitials(customer.name)}
        </div>
        <div className="customer-detail-profile-text">
          <div className="customer-premium-name-row">
            <h2>{customer.name}</h2>
            <span className={`customer-type-badge customer-type-badge--${customer.type}`}>
              {CUSTOMER_TYPE_LABELS[customer.type]}
            </span>
          </div>
          <p className="customer-detail-profile-meta">
            {customer.greenleafNumber && <span className="customer-premium-gl">{customer.greenleafNumber}</span>}
            {customer.phone && <span>{customer.phone}</span>}
            <span>{formatDateTime(customer.updatedAt)}</span>
          </p>
        </div>
      </div>

      <div className="customer-detail-hero">
        <div className="customer-detail-kpis">
          <div className="customer-detail-kpi">
            <span>Toplam Borç</span>
            <strong>{formatLedgerColumnAmount(ledgerTotals.debit)}</strong>
          </div>
          <div className="customer-detail-kpi">
            <span>Toplam Alacak</span>
            <strong>{formatLedgerColumnAmount(ledgerTotals.credit)}</strong>
          </div>
          <div className="customer-detail-kpi customer-detail-kpi--balance">
            <span>Cari Bakiye</span>
            <strong className={balanceDisplay.className}>{balanceDisplay.label}</strong>
          </div>
          <div className="customer-detail-kpi">
            <span>Net Harcama</span>
            <strong>{formatCurrency(summary.totalSpent)}</strong>
            {summary.totalRefunded > 0 && (
              <em className="customer-detail-kpi-hint">İade: {formatCurrency(summary.totalRefunded)}</em>
            )}
          </div>
          <div className="customer-detail-kpi">
            <span>Alışveriş</span>
            <strong>{summary.saleCount}</strong>
          </div>
          <div className="customer-detail-kpi">
            <span>Ürün Adedi</span>
            <strong>{summary.totalItems}</strong>
          </div>
          {showCostProfit && (
            <>
              <div className="customer-detail-kpi customer-detail-kpi--cost">
                <span>Toplam Maliyet</span>
                <strong>{formatCurrency(summary.totalCost)}</strong>
              </div>
              <div className="customer-detail-kpi customer-detail-kpi--profit">
                <span>Tahmini Kar</span>
                <strong>{formatCurrency(summary.totalProfit)}</strong>
              </div>
            </>
          )}
        </div>

        <div className="customer-detail-info-strip">
          {customer.greenleafNumber && (
            <div className="customer-info-pill customer-info-pill--gl">
              <small>Greenleaf No</small>
              <strong>{customer.greenleafNumber}</strong>
            </div>
          )}
          {(customer.sponsorName || customer.sponsorGreenleafNumber) && (
            <div className="customer-info-pill customer-info-pill--sponsor">
              <small>Sponsor</small>
              <strong>
                {customer.sponsorGreenleafNumber
                  ? `GL ${customer.sponsorGreenleafNumber}`
                  : customer.sponsorName}
              </strong>
              {customer.sponsorGreenleafNumber && customer.sponsorName && (
                <em>{customer.sponsorName}</em>
              )}
            </div>
          )}
          <div className="customer-info-pill">
            <small>{customer.type === 'corporate' ? 'VKN' : 'TC'}</small>
            <strong>{customer.taxNumber || '—'}</strong>
          </div>
          <div className="customer-info-pill">
            <small>Telefon</small>
            <strong>{customer.phone || '—'}</strong>
          </div>
          <div className="customer-info-pill">
            <small>E-posta</small>
            <strong>{customer.email || '—'}</strong>
          </div>
          <div className="customer-info-pill customer-info-pill--wide">
            <small>Konum</small>
            <strong>
              {[customer.district, customer.city].filter(Boolean).join(' / ') || '—'}
              {customer.address ? ` · ${customer.address}` : ''}
            </strong>
          </div>
        </div>

        {customer.notes && (
          <p className="customer-detail-note">
            <strong>Not:</strong> {customer.notes}
          </p>
        )}

        {customer.registeredFrom === 'pos' && (
          <p className="customer-detail-source">
            <span className="customer-type-badge customer-type-badge--pos">Kasiyer kaydı</span>
          </p>
        )}
      </div>

      <div className="customer-detail-block customer-detail-block--statement">
        <div className="customer-detail-block-head">
          <h3>Hareket Fişi</h3>
          <span>{statement.length} hareket</span>
        </div>
        {statement.length === 0 ? (
          <p className="customer-detail-empty">Henüz cari hareket kaydı yok.</p>
        ) : (
          <div className="customer-statement-table-wrap">
            <table className="module-table customer-statement-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>İşlem</th>
                  <th>Referans</th>
                  <th>Borç</th>
                  <th>Alacak</th>
                  <th>Bakiye</th>
                </tr>
              </thead>
              <tbody>
                {statement.map((row, index) => {
                  const isFinalBalance = index === statement.length - 1;
                  const balanceClass = [
                    row.balance > 0 ? 'is-negative' : row.balance < 0 ? 'is-positive' : '',
                    isFinalBalance ? 'customer-statement-balance-final' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                  <tr key={row.id} className={isFinalBalance ? 'customer-statement-row-final' : undefined}>
                    <td>{formatDateTime(row.date)}</td>
                    <td>{row.type}</td>
                    <td>{row.reference ?? '—'}</td>
                    <td>{row.debit > 0 ? formatCurrency(row.debit) : '—'}</td>
                    <td>{row.credit > 0 ? formatCurrency(row.credit) : '—'}</td>
                    <td className={balanceClass} title={isFinalBalance ? 'Güncel cari bakiye' : undefined}>
                      {formatCurrency(row.balance)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CustomerCrmSection store={store} customer={customer} />

      <div className="customer-detail-grid">
        <div className="customer-detail-block customer-detail-block--products">
          <div className="customer-detail-block-head">
            <h3>Alınan Ürünler</h3>
            <span>{summary.productsSummary.length} ürün</span>
          </div>
          {summary.productsSummary.length === 0 ? (
            <p className="customer-detail-empty">Bu müşteriye bağlı satış kaydı yok.</p>
          ) : (
            <ul className="customer-product-grid">
              {summary.productsSummary.map((item) => (
                <CustomerProductCard
                  key={item.productId}
                  product={getProductById(products, item.productId)}
                  quantity={item.quantity}
                  total={item.total}
                  totalCost={item.totalCost}
                  totalProfit={item.totalProfit}
                  showCostProfit={showCostProfit}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="customer-detail-block customer-detail-block--sales">
          <div className="customer-detail-block-head">
            <h3>Satış Geçmişi</h3>
            <span>{summary.customerSales.length} fiş</span>
          </div>
          {summary.customerSales.length === 0 ? (
            <p className="customer-detail-empty">Henüz fiş kaydı bulunmuyor.</p>
          ) : (
            <ul className="customer-sale-list">
              {summary.customerSales.map((sale) => {
                const status = getSaleStatus(sale, saleReturns);
                const netTotal = getSaleNetTotal(sale, saleReturns);
                const returnable = canReturnSale(sale, saleReturns);
                return (
                <li key={sale.id}>
                  <div className="customer-sale-head">
                    <strong>{sale.id}</strong>
                    <span>{formatDateTime(sale.createdAt)}</span>
                    <span className={`sale-status-badge sale-status-badge--${status}`}>
                      {SALE_STATUS_LABELS[status]}
                    </span>
                  </div>
                  <div className="customer-sale-meta">
                    <span>{PAYMENT_LABELS[sale.paymentMethod]}</span>
                    {sale.cashierName && <span className="customer-sale-cashier">{sale.cashierName}</span>}
                    <strong>{formatCurrency(netTotal)}</strong>
                    {netTotal < sale.total && (
                      <span className="sale-net-hint"> / {formatCurrency(sale.total)}</span>
                    )}
                    {returnable && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm sale-return-btn"
                        onClick={() => onReturnSale(sale)}
                      >
                        İade Al
                      </button>
                    )}
                  </div>
                  <ul className="customer-sale-items">
                    {sale.items.map((item, itemIndex) => {
                      const product = item.productId != null ? getProductById(products, item.productId) : undefined;
                      const lineKey = item.setId ?? item.productId ?? itemIndex;
                      const lineName = item.setId
                        ? `Set ${item.setId}`
                        : product?.name ?? `#${item.productId}`;
                      return (
                        <li key={`${sale.id}-${lineKey}`} className="customer-sale-item-row">
                          <div className="customer-sale-item-thumb">
                            {product ? (
                              <ProductImage product={product} size="sm" />
                            ) : (
                              <div className="customer-product-card-placeholder" aria-hidden>📦</div>
                            )}
                          </div>
                          <span className="customer-sale-item-name">
                            {lineName}
                          </span>
                          <span className="customer-sale-item-qty">× {item.quantity}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomerFormFields({
  form,
  setField,
}: {
  form: typeof EMPTY_FORM;
  setField: <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => void;
}) {
  const greenleafRef = useRef<HTMLInputElement>(null);
  const sponsorGlRef = useRef<HTMLInputElement>(null);
  const sponsorNameRef = useRef<HTMLInputElement>(null);
  const greenleafWasComplete = useRef(false);
  const sponsorGlWasComplete = useRef(false);
  const tcWasComplete = useRef(false);
  const addressRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const complete = isGreenleafInputComplete(form.greenleafNumber);
    if (complete && !greenleafWasComplete.current) {
      sponsorGlRef.current?.focus();
      sponsorGlRef.current?.select();
    }
    greenleafWasComplete.current = complete;
  }, [form.greenleafNumber]);

  useLayoutEffect(() => {
    const complete = isGreenleafInputComplete(form.sponsorGreenleafNumber);
    if (complete && !sponsorGlWasComplete.current) {
      sponsorNameRef.current?.focus();
    }
    sponsorGlWasComplete.current = complete;
  }, [form.sponsorGreenleafNumber]);

  const docCountry = resolveIdentityFormatCountry(
    form.identityDocumentCountryName,
    form.identityDocumentCountry,
  );
  const structuredAddressCountry = resolveStructuredAddressCountryFromForm(
    form.country,
    form.identityDocumentCountryName,
    form.type,
    form.identityDocumentCountry,
  );

  const formatCityDistrict = (value: string, country: StructuredAddressCountry) =>
    formatStructuredLocationInput(value, country);

  const applyCityChange = (city: string) => {
    const nextCity = structuredAddressCountry
      ? formatCityDistrict(city, structuredAddressCountry)
      : city;
    setField('city', nextCity);
    if (structuredAddressCountry && form.district) {
      const ok = resolveStructuredDistrict(nextCity, form.district, structuredAddressCountry);
      if (!ok) setField('district', '');
    }
  };

  const applyDistrictChange = (district: string) => {
    setField(
      'district',
      structuredAddressCountry
        ? formatCityDistrict(district, structuredAddressCountry)
        : district,
    );
  };

  const applyIdentityCountryChange = (name: string, pickedFormat: IdentityFormatCountry | null) => {
    const prevFormat = resolveIdentityFormatCountry(
      form.identityDocumentCountryName,
      form.identityDocumentCountry,
    );
    const nextFormat =
      pickedFormat ?? (name.trim() ? resolveIdentityFormatCountryFromName(name) : prevFormat);
    if (nextFormat !== prevFormat) {
      setField('taxNumber', '');
    }
    setField('identityDocumentCountryName', name);
    if (form.type === 'individual' && name.trim()) {
      setField('country', formatIdentityCountryNameInput(name.trim()));
    }
    if (pickedFormat !== null) {
      setField(
        'identityDocumentCountry',
        pickedFormat === 'OTHER' ? undefined : pickedFormat,
      );
    }
  };

  useLayoutEffect(() => {
    if (form.type !== 'individual') {
      tcWasComplete.current = false;
      return;
    }
    const complete = shouldAutoFocusAddressAfterIdentity(form.taxNumber, docCountry);
    if (complete && !tcWasComplete.current) {
      addressRef.current?.focus();
    }
    tcWasComplete.current = complete;
  }, [form.taxNumber, form.type, docCountry]);

  return (
    <>
      <div className="customer-type-tabs">
        {(['individual', 'corporate'] as CustomerType[]).map((type) => (
          <button
            key={type}
            type="button"
            className={form.type === type ? 'active' : ''}
            onClick={() => setField('type', type)}
          >
            {type === 'individual' ? '👤 Bireysel' : '🏢 Kurumsal'}
          </button>
        ))}
      </div>

      <div className="customer-form-sections">
        <fieldset className="customer-form-section">
          <legend>Greenleaf</legend>
          <div className="customer-form-grid">
            <label>
              Greenleaf No
              <input
                ref={greenleafRef}
                value={form.greenleafNumber}
                onChange={(e) => setField('greenleafNumber', parseGreenleafNumberInput(e.target.value))}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={GREENLEAF_NO_PLACEHOLDER}
              />
              <small className="customer-field-hint">{GREENLEAF_NO_HINT}</small>
            </label>
            <label>
              Sponsor Greenleaf No
              <input
                ref={sponsorGlRef}
                value={form.sponsorGreenleafNumber}
                onChange={(e) => setField('sponsorGreenleafNumber', parseGreenleafNumberInput(e.target.value))}
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={GREENLEAF_NO_PLACEHOLDER}
              />
            </label>
            <label className="customer-form-span2">
              Sponsor Adı
              <input
                ref={sponsorNameRef}
                value={form.sponsorName}
                onChange={(e) => setField('sponsorName', parseSponsorNameInput(e.target.value))}
                placeholder="Sponsor ad soyad"
                autoCapitalize="characters"
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="customer-form-section">
          <legend>Kimlik & Vergi</legend>
          <div className="customer-form-grid">
            <label className="customer-form-span2">
              {form.type === 'corporate' ? 'Firma Unvanı *' : 'Ad Soyad *'}
              <input
                value={form.name}
                onChange={(e) => setField('name', parseCustomerNameInput(e.target.value))}
                placeholder={form.type === 'corporate' ? 'Örn: ABC Ticaret Ltd. Şti.' : 'Ad Soyad'}
                autoCapitalize="characters"
              />
            </label>
            {form.type === 'individual' && (
              <label className="customer-form-span2">
                Kimlik / Pasaport Ülkesi *
                <IdentityCountryAutocomplete
                  value={form.identityDocumentCountryName}
                  placeholder="Yazmaya başlayın: Türkiye, Kazakistan, Almanya…"
                  onChange={applyIdentityCountryChange}
                  required
                />
              </label>
            )}
            <label className={form.type === 'individual' ? 'customer-form-span2' : undefined}>
              {form.type === 'corporate' ? 'VKN (10 hane) *' : 'TC Kimlik No / Pasaport No *'}
              <input
                value={form.taxNumber}
                onChange={(e) => setField(
                  'taxNumber',
                  form.type === 'corporate'
                    ? e.target.value.replace(/\D/g, '')
                    : parseIdentityDocumentInput(e.target.value, docCountry),
                )}
                inputMode={
                  form.type === 'corporate' || isIdentityDocumentNumericInput(docCountry)
                    ? 'numeric'
                    : 'text'
                }
                maxLength={
                  form.type === 'corporate' ? 10 : getIdentityDocumentMaxLength(docCountry)
                }
                placeholder={
                  form.type === 'corporate' ? '1234567890' : 'Kimlik veya pasaport numarası'
                }
                autoCapitalize={form.type === 'individual' ? 'characters' : 'off'}
              />
              {form.type === 'individual' && (
                <small className="customer-field-hint">
                  {getIdentityDocumentHintForFormat(docCountry)}
                </small>
              )}
            </label>
            {form.type === 'corporate' && (
              <label>
                Vergi Dairesi *
                <input
                  value={form.taxOffice}
                  onChange={(e) => setField('taxOffice', e.target.value)}
                  placeholder="Örn: Antalya Kurumlar"
                />
              </label>
            )}
          </div>
        </fieldset>

        <fieldset className="customer-form-section">
          <legend>Fatura Adresi</legend>
          <div className="customer-form-grid">
            <label className="customer-form-span2">
              Adres (Mahalle, Sokak, No) *
              <textarea
                ref={addressRef}
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                rows={2}
                placeholder="Mahalle, cadde/sokak, bina no, daire"
              />
            </label>
            <label>
              İl *
              {structuredAddressCountry ? (
                <StructuredLocationAutocomplete
                  country={structuredAddressCountry}
                  mode="province"
                  value={form.city}
                  placeholder="Yazın: Antalya, Moskova, Bakü…"
                  onChange={applyCityChange}
                  required
                />
              ) : (
                <input
                  value={form.city}
                  onChange={(e) => setField('city', e.target.value)}
                  placeholder="Antalya"
                />
              )}
            </label>
            <label>
              İlçe *
              {structuredAddressCountry ? (
                <StructuredLocationAutocomplete
                  country={structuredAddressCountry}
                  mode="district"
                  value={form.district}
                  regionContext={form.city}
                  placeholder="Yazın: ilçe / şehir…"
                  onChange={applyDistrictChange}
                  required
                />
              ) : (
                <input
                  value={form.district}
                  onChange={(e) => setField('district', e.target.value)}
                  placeholder="Muratpaşa"
                />
              )}
            </label>
            <label>
              Posta Kodu
              <input value={form.postalCode} onChange={(e) => setField('postalCode', e.target.value)} placeholder="07000" />
            </label>
            <label>
              Ülke
              <input value={form.country} onChange={(e) => setField('country', e.target.value)} />
            </label>
          </div>
        </fieldset>

        <fieldset className="customer-form-section">
          <legend>İletişim</legend>
          <div className="customer-form-grid">
            <label>
              Telefon
              <CustomerPhoneInput
                countryName={form.country}
                value={form.phone}
                onChange={(phone) => setField('phone', phone)}
              />
            </label>
            <label>
              E-posta
              <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="ornek@mail.com" />
            </label>
            <label className="customer-form-span2">
              Not
              <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={2} placeholder="Ek bilgi..." />
            </label>
          </div>
        </fieldset>
      </div>
    </>
  );
}

export function CustomersScreen({ store, embedded = false }: CustomersScreenProps) {
  const isCashier = isCashierSession(store.authSession);
  const isAdmin = store.authSession?.role === 'admin';
  const [search, setSearch] = useState('');
  const [hubMode, setHubMode] = useState<'customers' | 'crm'>('customers');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const showCostProfit = store.costProfitRevealed && !isCashier;
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);

  const cashierCustomerIds = useMemo(
    () => getCustomerIdsInCashierWindow(store.sales, store.customers),
    [store.sales, store.customers],
  );

  const filtered = useMemo(() => {
    let list = isCashier
      ? store.customers.filter((customer) => cashierCustomerIds.has(customer.id))
      : store.customers;
    const q = search.trim();
    if (!q) return list;
    if (isCashier) {
      return list.filter((customer) => customerMatchesCashierSearch(customer, q));
    }
    return list.filter((c) => customerMatchesSearch(c, q));
  }, [store.customers, search, isCashier, cashierCustomerIds]);

  const customerSummaries = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getCustomerPurchaseSummary>>();
    for (const customer of store.customers) {
      map.set(
        customer.id,
        getCustomerPurchaseSummary(store.sales, store.products, customer.id, store.saleReturns, store.customers),
      );
    }
    return map;
  }, [store.customers, store.sales, store.products, store.saleReturns]);

  const customerBalances = useMemo(() => {
    const map = new Map<string, number>();
    for (const customer of store.customers) {
      map.set(customer.id, getCustomerLedgerBalance(customer.id, store.customerLedger));
    }
    return map;
  }, [store.customers, store.customerLedger]);

  const customerLedgerTotals = useMemo(() => {
    const map = new Map<string, LedgerDebitCreditTotals>();
    for (const customer of store.customers) {
      map.set(customer.id, getCustomerLedgerTotalsForId(customer.id, store.customerLedger));
    }
    return map;
  }, [store.customers, store.customerLedger]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const openNewForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormMode('new');
    setError(null);
  };

  const openEditForm = (customer: Customer) => {
    setEditingId(customer.id);
    const identityCountryName = getIdentityCountryDisplayLabel(
      customer.identityDocumentCountry,
      customer.identityDocumentCountryName,
    );
    const structuredCountry = resolveStructuredAddressCountryFromForm(
      customer.country,
      identityCountryName,
      customer.type,
      customer.identityDocumentCountry,
    );
    setForm({
      type: customer.type,
      name: customer.name,
      greenleafNumber: customer.greenleafNumber ?? '',
      sponsorName: customer.sponsorName ?? '',
      sponsorGreenleafNumber: customer.sponsorGreenleafNumber ?? '',
      taxNumber: customer.taxNumber,
      identityDocumentCountry: customer.identityDocumentCountry,
      identityDocumentCountryName: identityCountryName,
      taxOffice: customer.taxOffice ?? '',
      address: customer.address,
      city: structuredCountry
        ? formatStructuredLocationInput(customer.city, structuredCountry)
        : customer.city,
      district: structuredCountry
        ? formatStructuredLocationInput(customer.district, structuredCountry)
        : customer.district,
      postalCode: customer.postalCode ?? '',
      country:
        customer.type === 'individual' && identityCountryName
          ? identityCountryName
          : customer.country,
      phone: customer.phone ?? '',
      email: customer.email ?? '',
      notes: customer.notes ?? '',
    });
    setFormMode('edit');
    setError(null);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = () => {
    const payload = {
      type: form.type,
      name: form.name.trim(),
      greenleafNumber: form.greenleafNumber.trim()
        ? formatGreenleafNumber(form.greenleafNumber)
        : undefined,
      sponsorName: form.sponsorName.trim() || undefined,
      sponsorGreenleafNumber: form.sponsorGreenleafNumber.trim()
        ? formatGreenleafNumber(form.sponsorGreenleafNumber)
        : undefined,
      taxNumber: formatTaxNumber(
        form.type,
        form.taxNumber,
        form.identityDocumentCountry,
        form.identityDocumentCountryName,
      ),
      identityDocumentCountryName:
        form.type === 'individual'
          ? formatIdentityCountryNameInput(form.identityDocumentCountryName.trim())
          : undefined,
      identityDocumentCountry:
        form.type === 'individual'
          ? (() => {
              const format = resolveIdentityFormatCountry(
                form.identityDocumentCountryName,
                form.identityDocumentCountry,
              );
              return format === 'OTHER' ? undefined : format;
            })()
          : undefined,
      taxOffice: form.type === 'corporate' ? form.taxOffice.trim() : undefined,
      address: form.address.trim(),
      city: (() => {
        const trimmed = form.city.trim();
        const structured = resolveStructuredAddressCountryFromForm(
          form.country,
          form.identityDocumentCountryName,
          form.type,
          form.identityDocumentCountry,
        );
        return structured ? formatStructuredLocationInput(trimmed, structured) : trimmed;
      })(),
      district: (() => {
        const trimmed = form.district.trim();
        const structured = resolveStructuredAddressCountryFromForm(
          form.country,
          form.identityDocumentCountryName,
          form.type,
          form.identityDocumentCountry,
        );
        return structured ? formatStructuredLocationInput(trimmed, structured) : trimmed;
      })(),
      postalCode: form.postalCode.trim() || undefined,
      country: form.country.trim() || 'Türkiye',
      phone: (() => {
        const trimmed = form.phone.trim();
        if (!trimmed) return undefined;
        return normalizePhoneForCountry(form.country, trimmed);
      })(),
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
    };

    const validationError = validateCustomerInput(payload, {
      existingCustomers: store.customers,
      editingId: editingId ?? undefined,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    if (editingId) {
      store.updateCustomer(editingId, payload);
      showToast('Müşteri güncellendi');
    } else {
      const customer = store.addCustomer(payload);
      setSelectedId(customer.id);
      showToast('Müşteri eklendi');
    }
    closeForm();
  };

  const toggleCustomer = (customerId: string) => {
    if (isCashier) return;
    setSelectedId((prev) => (prev === customerId ? null : customerId));
  };

  const closeCustomer = () => {
    setSelectedId(null);
  };

  const handleDelete = (customer: Customer) => {
    store.removeCustomer(customer.id);
    if (selectedId === customer.id) setSelectedId(null);
    showToast('Müşteri silindi');
  };

  const selectedCustomer = selectedId
    ? store.customers.find((c) => c.id === selectedId) ?? null
    : null;
  const selectedSummary = selectedCustomer
    ? customerSummaries.get(selectedCustomer.id) ?? null
    : null;

  if (hubMode === 'crm' && isAdmin && !embedded) {
    return (
      <div className="module-screen customer-screen--premium">
        <header className="module-header customer-page-header customer-page-header--unified">
          <div className="customer-page-intro">
            <h1>CRM Merkezi</h1>
            <p>Lead, kampanya, segment ve veri yönetimi</p>
          </div>
          <button type="button" className="btn btn-outline" onClick={() => setHubMode('customers')}>
            ← Müşteri listesi
          </button>
        </header>
        <CrmCenterPanel store={store} />
      </div>
    );
  }

  return (
    <div className={`module-screen customer-screen--premium ${embedded ? 'customer-screen--embedded' : ''}`}>
      <header className="module-header customer-page-header customer-page-header--unified">
        <div className="customer-page-intro">
          {!embedded && <h1>{isCashier ? 'Müşteriler' : 'Müşteri Yönetimi'}</h1>}
          <p className="customer-page-meta">
            {isCashier
              ? `Son 3 gün içinde alışveriş yapan ${filtered.length} müşteri`
              : `${store.customers.length} kayıtlı müşteri · Greenleaf CRM & fatura bilgileri`}
          </p>
        </div>

        <div className="search-box customer-premium-search">
          <span className="search-icon">🔍</span>
          <input
            type="search"
            placeholder={isCashier ? 'Greenleaf no ile ara...' : 'Ad, Greenleaf no, sponsor, TC/VKN, telefon...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="customer-page-actions">
          {isAdmin && !embedded && (
            <div className="customer-view-toggle" role="group" aria-label="CRM modu">
              <button
                type="button"
                className={hubMode === 'customers' ? 'active' : ''}
                onClick={() => setHubMode('customers')}
              >
                Müşteriler
              </button>
              <button
                type="button"
                className={hubMode === 'crm' ? 'active' : ''}
                onClick={() => { setHubMode('crm'); setSelectedId(null); }}
              >
                CRM Merkezi
              </button>
            </div>
          )}
          <span className="customer-premium-count">{filtered.length} müşteri</span>
          <div className="customer-view-toggle" role="group" aria-label="Görünüm">
            <button
              type="button"
              className={viewMode === 'cards' ? 'active' : ''}
              onClick={() => setViewMode('cards')}
            >
              ⊞ Kart
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              ≡ Liste
            </button>
          </div>
          {!isCashier && (
            <button type="button" className="btn btn-primary btn-sm" onClick={openNewForm}>
              + Yeni
            </button>
          )}
        </div>
      </header>

      {isCashier && (
        <p className="cashier-privacy-notice" role="note">{CASHIER_PRIVACY_NOTICE}</p>
      )}

      {toast && <div className="sale-toast" role="status">✓ {toast}</div>}

      {filtered.length === 0 ? (
        <div className="customer-premium-empty module-card">
          <p className="module-empty">
            {isCashier
              ? 'Son 3 gün içinde alışveriş yapan müşteri bulunamadı.'
              : 'Müşteri bulunamadı'}
          </p>
        </div>
      ) : (
        <div className={`customer-browser ${selectedId ? 'customer-browser--detail' : ''}`}>
          <div className="customer-browser-list">
            {viewMode === 'cards' ? (
              <ul className="customer-premium-grid">
                {filtered.map((customer) => {
                  const isSelected = selectedId === customer.id;
                  const saleCount = getCustomerSaleCount(store.sales, customer.id, store.customers);
                  const summary = customerSummaries.get(customer.id) ?? null;
                  const ledgerBalance = customerBalances.get(customer.id) ?? 0;
                  const balanceDisplay = formatLedgerBalanceDisplay(ledgerBalance);
                  const displayName = displayCustomerName(customer.name, isCashier);

                  return (
                    <li key={customer.id} className={`customer-premium-item ${isSelected ? 'selected' : ''}`}>
                      <article className="customer-premium-card">
                        <div className="customer-premium-card-body">
                          <div className="customer-premium-card-head">
                            <div className="customer-premium-avatar" aria-hidden="true">
                              {isCashier ? getMaskedCustomerInitials(customer.name) : getCustomerInitials(customer.name)}
                            </div>
                            <div className="customer-premium-title">
                              <div className="customer-premium-name-row">
                                <strong>{displayName}</strong>
                                {!isCashier && (
                                  <span className={`customer-type-badge customer-type-badge--${customer.type}`}>
                                    {CUSTOMER_TYPE_LABELS[customer.type]}
                                  </span>
                                )}
                              </div>
                              <div className="customer-premium-subline">
                                {customer.greenleafNumber && (
                                  <span className="customer-premium-gl">{customer.greenleafNumber}</span>
                                )}
                                {!isCashier && customer.phone && <span>{customer.phone}</span>}
                                {!isCashier && (customer.district || customer.city) && (
                                  <span>{[customer.district, customer.city].filter(Boolean).join(' / ')}</span>
                                )}
                              </div>
                            </div>
                            <div className="customer-premium-head-stats">
                              {saleCount > 0 && (
                                <span className="customer-sale-badge">{saleCount} alışveriş</span>
                              )}
                              <span className={`customer-balance-badge ${balanceDisplay.className}`}>
                                Bakiye {balanceDisplay.label}
                              </span>
                              {summary && summary.totalSpent > 0 && (
                                <span className="customer-spend-badge">Satış {formatCurrency(summary.totalSpent)}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        {!isCashier && (
                          <div className="customer-premium-card-footer" onClick={(e) => e.stopPropagation()}>
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditForm(customer)}>
                              Düzenle
                            </button>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm customer-premium-expand"
                              onClick={() => toggleCustomer(customer.id)}
                            >
                              {isSelected ? 'Kapat' : 'Detay'}
                            </button>
                            {customer.registeredFrom === 'pos' && (
                              <span className="customer-type-badge customer-type-badge--pos customer-card-source">
                                Kasiyer
                              </span>
                            )}
                          </div>
                        )}
                      </article>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="module-card module-card--flush customer-list-table-wrap">
                <table className="module-table customer-list-table">
                  <thead>
                    <tr>
                      <th>Müşteri</th>
                      <th>Greenleaf</th>
                      {!isCashier && <th>Telefon</th>}
                      <th>Alışveriş</th>
                      <th className="customer-list-col-num">Borç</th>
                      <th className="customer-list-col-num">Alacak</th>
                      <th className="customer-list-col-num">Cari Bakiye</th>
                      <th className="customer-list-col-num">Satış Toplamı</th>
                      {showCostProfit && <th className="customer-list-col-num">Maliyet</th>}
                      {showCostProfit && <th className="customer-list-col-num">Tahmini Kar</th>}
                      {!isCashier && <th>Detay</th>}
                      {!isCashier && <th>Kaynak</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((customer) => {
                      const isSelected = selectedId === customer.id;
                      const saleCount = getCustomerSaleCount(store.sales, customer.id, store.customers);
                      const summary = customerSummaries.get(customer.id) ?? null;
                      const ledgerBalance = customerBalances.get(customer.id) ?? 0;
                      const ledgerTotals = customerLedgerTotals.get(customer.id)!;
                      const balanceDisplay = formatLedgerBalanceDisplay(ledgerBalance);
                      const handleCellToggle = () => toggleCustomer(customer.id);
                      const displayName = displayCustomerName(customer.name, isCashier);

                      return (
                        <tr key={customer.id} className={isSelected ? 'selected' : ''}>
                          <td
                            className="customer-list-cell"
                            onClick={isCashier ? undefined : handleCellToggle}
                            role={isCashier ? undefined : 'button'}
                            tabIndex={isCashier ? undefined : 0}
                            onKeyDown={isCashier ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}
                          >
                            <div className="customer-list-row-name">
                              <span className="customer-list-row-avatar" aria-hidden="true">
                                {isCashier ? getMaskedCustomerInitials(customer.name) : getCustomerInitials(customer.name)}
                              </span>
                              <strong>{displayName}</strong>
                            </div>
                          </td>
                          <td
                            className="customer-list-cell mono"
                            onClick={isCashier ? undefined : handleCellToggle}
                            role={isCashier ? undefined : 'button'}
                            tabIndex={isCashier ? undefined : 0}
                            onKeyDown={isCashier ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}
                          >
                            {customer.greenleafNumber ?? '—'}
                          </td>
                          {!isCashier && (
                            <td className="customer-list-cell" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                              {customer.phone ?? '—'}
                            </td>
                          )}
                          <td
                            className="customer-list-cell"
                            onClick={isCashier ? undefined : handleCellToggle}
                            role={isCashier ? undefined : 'button'}
                            tabIndex={isCashier ? undefined : 0}
                            onKeyDown={isCashier ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}
                          >
                            {saleCount > 0 ? `${saleCount} alışveriş` : '—'}
                          </td>
                          <td
                            className="customer-list-cell customer-list-col-num customer-list-cell--muted"
                            onClick={isCashier ? undefined : handleCellToggle}
                            role={isCashier ? undefined : 'button'}
                            tabIndex={isCashier ? undefined : 0}
                            onKeyDown={isCashier ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}
                          >
                            {formatLedgerColumnAmount(ledgerTotals.debit)}
                          </td>
                          <td
                            className="customer-list-cell customer-list-col-num customer-list-cell--muted"
                            onClick={isCashier ? undefined : handleCellToggle}
                            role={isCashier ? undefined : 'button'}
                            tabIndex={isCashier ? undefined : 0}
                            onKeyDown={isCashier ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}
                          >
                            {formatLedgerColumnAmount(ledgerTotals.credit)}
                          </td>
                          <td
                            className="customer-list-cell customer-list-col-num"
                            onClick={isCashier ? undefined : handleCellToggle}
                            role={isCashier ? undefined : 'button'}
                            tabIndex={isCashier ? undefined : 0}
                            onKeyDown={isCashier ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}
                          >
                            <strong className={balanceDisplay.className}>{balanceDisplay.label}</strong>
                          </td>
                          <td
                            className="customer-list-cell customer-list-cell--muted customer-list-col-num"
                            onClick={isCashier ? undefined : handleCellToggle}
                            role={isCashier ? undefined : 'button'}
                            tabIndex={isCashier ? undefined : 0}
                            onKeyDown={isCashier ? undefined : (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}
                          >
                            {summary && summary.totalSpent > 0 ? formatCurrency(summary.totalSpent) : '—'}
                          </td>
                          {showCostProfit && (
                            <td className="customer-list-cell customer-list-cell--finance customer-list-col-num" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                              {summary && summary.totalCost > 0 ? formatCurrency(summary.totalCost) : '—'}
                            </td>
                          )}
                          {showCostProfit && (
                            <td className="customer-list-cell customer-list-cell--finance customer-list-cell--profit customer-list-col-num" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                              <strong>{summary && summary.totalProfit > 0 ? formatCurrency(summary.totalProfit) : '—'}</strong>
                            </td>
                          )}
                          {!isCashier && (
                            <td className="customer-list-cell customer-list-cell--action">
                              <button
                                type="button"
                                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                                onClick={handleCellToggle}
                              >
                                {isSelected ? 'Kapat' : 'Detay'}
                              </button>
                            </td>
                          )}
                          {!isCashier && (
                            <td className="customer-list-cell customer-list-cell--source" onClick={handleCellToggle} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCellToggle(); } }}>
                              {customer.registeredFrom === 'pos' ? (
                                <span className="customer-type-badge customer-type-badge--pos">Kasiyer</span>
                              ) : (
                                <span className="customer-list-source-muted">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedCustomer && selectedSummary && !isCashier && (
            <aside className="customer-browser-detail">
              <CustomerDetailPanel
                customer={selectedCustomer}
                summary={selectedSummary}
                products={store.products}
                saleReturns={store.saleReturns}
                showCostProfit={showCostProfit}
                ledgerBalance={customerBalances.get(selectedCustomer.id) ?? 0}
                customerLedger={store.customerLedger}
                store={store}
                onEdit={() => openEditForm(selectedCustomer)}
                onDelete={() => handleDelete(selectedCustomer)}
                onClose={closeCustomer}
                onReturnSale={setReturnSale}
              />
            </aside>
          )}
        </div>
      )}

      <SaleReturnModal
        open={returnSale != null}
        sale={returnSale}
        saleReturns={store.saleReturns}
        products={store.products}
        productSets={store.productSets}
        cashierMode={isCashier}
        onClose={() => setReturnSale(null)}
        onConfirm={async (saleId, lines, refundMethod, reason, note) => {
          const result = store.processSaleReturn(saleId, lines, refundMethod, reason, note);
          if (!result.ok || !result.returnRecord) return result;

          const sale = store.sales.find((entry) => entry.id === saleId);
          if (sale) {
            const printResult = await printSaleReturnReceipt({
              businessName: store.settings.businessName,
              sale,
              returnRecord: result.returnRecord,
              products: store.products,
              productSets: store.productSets,
            });
            showToast(formatReturnReceiptToastMessage(result.returnRecord.id, printResult));
          } else {
            showToast(`İade tamamlandı — ${result.returnRecord.id}`);
          }

          setReturnSale(null);
          return result;
        }}
      />

      {formMode && (
        <div className="customer-modal-backdrop" role="presentation" onClick={closeForm}>
          <div
            className="customer-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="customer-form-head">
              <h2 id="customer-form-title">{formMode === 'edit' ? 'Müşteri Düzenle' : 'Yeni Müşteri'}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeForm} aria-label="Kapat">
                ✕
              </button>
            </div>

            <CustomerFormFields form={form} setField={setField} />

            {error && <p className="customer-form-error" role="alert">{error}</p>}

            <div className="customer-form-actions">
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>
                {formMode === 'edit' ? 'Güncelle' : 'Müşteri Ekle'}
              </button>
              <button type="button" className="btn btn-outline" onClick={closeForm}>Vazgeç</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
