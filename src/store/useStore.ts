import { useCallback, useEffect, useRef, useState } from 'react';
import { SEED_PRODUCTS } from '../data/seedProducts';
import { GREENLEAF_PRODUCTS } from '../data/greenleafCatalog';
import { PRODUCT_CATEGORIES } from '../data/categories';
import { createDemoPurchaseInvoices, createDemoSales, isDemoPurchaseInvoice, isDemoSale } from '../data/demoVatData';
import {
  applyDemoSupplierStockUpdates,
  createDemoSupplier,
  createDemoSupplierLedgerEntries,
  createDemoSupplierPurchaseInvoices,
  isDemoSupplier,
  isDemoSupplierPurchaseInvoice,
} from '../data/demoSupplierPurchases';
import { DEFAULT_USERS } from '../data/defaultUsers';
import { splitGrossAmount } from '../utils/vatAnalytics';
import { ALL_APP_PAGES, DEFAULT_CASHIER_TABS } from '../data/navigation';
import { PRICE_BATCH_1_BY_PRODUCT_ID } from '../data/priceCatalogBatch1';
import { IRSALIYE_STOCK_MIGRATION_KEY, irsaliyeEanForCode } from '../data/irsaliyeLuy2026000000002';
import { applyCatalogPricing } from '../utils/productPricing';
import { applyIrsaliyeStockToProducts, resolveWarehouseStockForProduct } from '../utils/applyIrsaliyeStock';
import { resetStoreToIrsaliyeWarehouse } from '../utils/warehouseReset';
import { fetchStoreSnapshot, saveStoreSnapshot } from '../services/storeApi';
import { clearAuthSession, loadAuthSession, saveAuthSession } from '../storage/authSession';
import {
  loadAllImages,
  migrateImagesFromProducts,
  removeProductImage as removeStoredImage,
  saveProductImage,
} from '../storage/productImages';
import type {
  AppSettings,
  CashHandover,
  Customer,
  DailyCashSession,
  Expense,
  ExpenseCategory,
  CustomExpenseCategory,
  PurchaseInvoice,
} from '../types/business';
import {
  createCustomExpenseCategoryId,
  normalizeCustomExpenseCategories,
} from '../utils/expenseCategories';
import {
  DEFAULT_POS_NOTES,
  DEFAULT_SETTINGS,
  normalizeUtilityBillSubscriptions,
  type PosNote,
} from '../types/business';
import { DEFAULT_POS_CHECKOUT_SETTINGS, type CompleteSaleOptions, type HeldPosSale } from '../types/pos';
import { computeChange, validatePaymentSplits } from '../utils/posCheckout';
import { loadHeldPosSales, saveHeldPosSales } from '../storage/heldPosSales';
import type { CurrencySettings, ExchangeRateQuote } from '../types/currency';
import { DEFAULT_CURRENCY_SETTINGS } from '../types/currency';
import { normalizeDashboardWidgets, type DashboardWidgetsConfig } from '../types/dashboard';
import type {
  PaymentRecurrence,
  PaymentReminder,
  PaymentReminderCategory,
  PaymentScope,
} from '../types/paymentReminder';
import { normalizePaymentReminders } from '../types/paymentReminder';
import {
  createBillEmailSource,
  normalizeBillEmailIngestion,
  type BillEmailIngestionSettings,
  type BillEmailSource,
} from '../types/billEmailIngestion';
import {
  normalizeSoleProprietorshipTaxCalendar,
  type SoleProprietorshipTaxCalendarSettings,
} from '../types/soleProprietorshipTaxCalendar';
import {
  TAX_AUTO_ID_PREFIX,
  buildSoleProprietorshipTaxReminders,
  getActiveTaxTemplates,
  isAutoTaxReminder,
} from '../utils/soleProprietorshipTaxCalendar';
import {
  ASAT_SCOPE_LABELS,
  DEFAULT_UTILITY_BILL_AUTO_SYNC,
  type UtilityBillSubscription,
} from '../types/utilityBillSubscription';
import { advanceDueDate, todayKey } from '../utils/paymentReminderAnalytics';
import { fetchAsatDebt } from '../services/asatService';
import {
  fetchTcmbRates,
  mergeTcmbIntoSettings,
  updateManualRate,
} from '../services/exchangeRateService';
import type { PersistedStoreSnapshot } from '../types/persistedStore';
import { hasPersistedStoreData } from '../types/persistedStore';
import type { CartItem, PriceType, Product, Sale, SaleMode, StockMovement, StockMovementType, WholesalePrices } from '../types/product';
import type { ProductSet, ProductSetItem } from '../types/productSet';
import type { SaleReturn } from '../types/saleReturn';
import { CASHIER_RETURN_EXPIRED_MESSAGE, isSaleReturnableByCashier } from '../utils/cashierPrivacy';
import { buildReturnLines, getSaleStatus } from '../utils/saleReturn';
import type { AuthSession, LoginResult, PosUser, UserRole } from '../types/user';
import {
  buildQuickCustomerPayload,
  normalizeGreenleafNumber,
  normalizeIdentityDocumentCountry,
  parseGreenleafNumberInput,
  validateQuickCustomerInput,
} from '../utils/customerValidation';
import { buildSaleLedgerEntries, syncCustomerLedgerFromSales } from '../utils/customerLedgerSync';
import { isSaleCustomerAttributed, repairSaleCustomerLinks, resolveSaleCustomerId } from '../utils/saleCustomerLink';
import { getDeviceInfo } from '../utils/deviceInfo';
import { getClientIp } from '../utils/clientIp';
import {
  adminUnlockLogin,
  checkLoginAllowed,
  clearLoginLockout,
  getAllLoginLockouts,
  recordFailedLogin,
} from '../utils/loginLockout';
import { hashPin, isValidPin, verifyPin } from '../utils/pin';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateTotpSecret, verifyTotpCode, buildTotpUri } from '../utils/totp';
import { DEFAULT_PRODUCT_SETS } from '../data/defaultProductSets';
import { getCartUnitPrice, resolveSalePriceType } from '../utils/salePricing';
import { getProductSetSalePrice } from '../utils/setPricing';
import { SAMPLE_PRODUCT_DEFAULTS } from '../utils/sampleProduct';
import { buildWholesalePricesFromBase, getProductWholesaleBasePrice, resolveWholesalePrices, type WholesalePriceBase, type WholesaleTierDiscounts } from '../utils/wholesalePricing';
import { formatCurrency, formatCurrencyTry } from '../utils/format';
import { resolveBarcodeScan, type BarcodeScanApplyResult } from '../utils/barcodeScan';
import { getNextBusinessDateKey, getPreviousBusinessDateKey } from '../utils/businessDate';
import {
  computeDayCashDrawer,
  filterByBusinessDate,
  getCashSessionForDate,
  getOperationalBusinessDateKey,
  reconcileCashSessions,
} from '../utils/cashSession';
import { sumCashVirmanForDate } from '../utils/cashRegisterTransfers';
import { buildAuthSession, resolveUserAllowedTabs } from '../utils/userAccess';
import { saveLastQuickUser } from '../storage/quickLogin';
import type { LoginAuditEntry, LoginLockoutRecord } from '../types/security';
import { MAX_LOGIN_AUDIT_ENTRIES } from '../types/security';
import type { LoginMethod } from '../types/security';
import type { ActivityAction, ActivityAuditEntry } from '../utils/activityAudit';
import { getPageLabel, MAX_ACTIVITY_AUDIT_ENTRIES } from '../utils/activityAudit';
import type { AppPage } from '../components/AppShell';
import type {
  BankAccount,
  BankTransaction,
  CapitalContribution,
  CashCountVariance,
  CheckNote,
  CustomerLedgerEntry,
  EquityPartner,
  PeriodClosure,
  StockAdjustment,
  Supplier,
  SupplierLedgerEntry,
} from '../types/accounting';
import type { JournalVoucher } from '../types/journalVoucher';
import { createAccountingMethods } from './accountingMethods';
import { loadAccountingSnapshot, mergeAccountingFromPersisted, saveAccountingSnapshot } from './accountingPersistence';
import {
  getCrmSettings,
  loadCrmData,
  normalizeCrmData,
  saveCrmDataLocal,
} from './crmPersistence';
import {
  DEFAULT_CRM_SETTINGS,
  type CrmAutomationFlow,
  type CrmPersistedData,
  type CrmSavedSegment,
  type CrmSettings,
  type CustomerCrmProfile,
} from '../types/crm';
import { normalizeCrmProfile, withUpdatedCrm, getCustomerCrmProfile } from '../utils/crm/profile';
import { buildCheckoutPreview } from '../utils/crm/checkout';
import { computeDueDateKey } from '../utils/crm/credit';
import { mergeCustomersData } from '../utils/crm/merge';
import { parseCustomerCsv, rowsToCustomers } from '../utils/crm/importExport';
import { runDailyAutomation } from '../utils/crm/automation';
import { sendCrmEmailApi } from '../services/crmOutreachService';
import {
  crmAttachmentKey,
  readFileAsDataUrl,
  removeCrmAttachment,
  saveCrmAttachment,
} from '../storage/crmAttachments';

const STORAGE_KEYS = {
  products: 'market-pos-products',
  sales: 'market-pos-sales',
  saleReturns: 'market-pos-sale-returns',
  cart: 'market-pos-cart',
  priceType: 'market-pos-price-type',
  stockMovements: 'market-pos-stock-movements',
  stockInitialized: 'market-pos-stock-initialized',
  customers: 'market-pos-customers',
  expenses: 'market-pos-expenses',
  cashHandovers: 'market-pos-cash-handovers',
  cashSessions: 'market-pos-cash-sessions',
  purchaseInvoices: 'market-pos-purchase-invoices',
  demoVatSeeded: 'market-pos-demo-vat-seeded',
  demoSupplierSeeded: 'market-pos-demo-supplier-seeded',
  settings: 'market-pos-settings',
  users: 'market-pos-users',
  loginAuditLog: 'market-pos-login-audit',
  activityAuditLog: 'market-pos-activity-audit',
  productSets: 'market-pos-product-sets',
};

const CATALOG_PRODUCTS: Array<Omit<Product, 'stock'>> = [
  ...SEED_PRODUCTS.map((seed) => ({
    ...seed,
    category: PRODUCT_CATEGORIES[seed.id] ?? 'kisisel-bakim',
  })),
  ...GREENLEAF_PRODUCTS,
];

function mergeWithSeed(stored: Product[] | null): Product[] {
  const storedMap = new Map((stored ?? []).map((p) => [p.id, p]));
  const images = loadAllImages();
  if (stored) migrateImagesFromProducts(stored);

  return CATALOG_PRODUCTS.map((seed) => {
    const saved = storedMap.get(seed.id);
    const imageUrl = images[seed.id] ?? saved?.imageUrl ?? seed.imageUrl;
    const category = saved?.category ?? seed.category;
    const catalogEntry = PRICE_BATCH_1_BY_PRODUCT_ID[seed.id];
    const priced = catalogEntry ? applyCatalogPricing(seed, catalogEntry) : seed;
    const sampleDefaults = SAMPLE_PRODUCT_DEFAULTS[seed.id];
    const isSample = saved?.isSample ?? Boolean(sampleDefaults);
    const sampleStock = saved?.sampleStock ?? sampleDefaults?.sampleStock ?? 0;
    const productCode = catalogEntry ? priced.productCode : (saved?.productCode ?? priced.productCode);
    const irsaliyeEan = catalogEntry ? irsaliyeEanForCode(catalogEntry.code) : irsaliyeEanForCode(productCode);
    const barcode =
      irsaliyeEan
      ?? (saved?.barcode?.trim() || priced.barcode || productCode);

    return {
      ...priced,
      category,
      stock: resolveWarehouseStockForProduct({
        id: seed.id,
        productCode,
        barcode,
      }),
      isSample,
      sampleStock: isSample ? sampleStock : 0,
      imageUrl,
      productCode,
      barcode,
      wholesalePrices: resolveWholesalePrices(priced.fullSalePrice, saved?.wholesalePrices),
    };
  });
}

function loadProducts(): Product[] {
  const stored = localStorage.getItem(STORAGE_KEYS.products);
  if (stored) {
    try {
      return mergeWithSeed(JSON.parse(stored) as Product[]);
    } catch {
      /* fall through */
    }
  }
  return mergeWithSeed(null);
}

function mergeProductSets(stored: ProductSet[] | null | undefined): ProductSet[] {
  const storedMap = new Map((stored ?? []).map((set) => [set.id, set]));
  const mergedIds = new Set<string>();

  const merged = DEFAULT_PRODUCT_SETS.map((seed) => {
    const saved = storedMap.get(seed.id);
    mergedIds.add(seed.id);
    if (!saved) return { ...seed };
    return {
      ...seed,
      ...saved,
      items: saved.items?.length ? saved.items : seed.items,
      stockCode: saved.stockCode || seed.stockCode,
      name: saved.name || seed.name,
    };
  });

  for (const saved of stored ?? []) {
    if (!mergedIds.has(saved.id)) {
      merged.push(saved);
    }
  }

  return merged;
}

function loadProductSets(): ProductSet[] {
  const stored = localStorage.getItem(STORAGE_KEYS.productSets);
  if (stored) {
    try {
      return mergeProductSets(JSON.parse(stored) as ProductSet[]);
    } catch {
      /* fall through */
    }
  }
  return mergeProductSets(null);
}

function loadCart(): CartItem[] {
  const stored = localStorage.getItem(STORAGE_KEYS.cart);
  if (stored) {
    try {
      return JSON.parse(stored) as CartItem[];
    } catch {
      return [];
    }
  }
  return [];
}

function loadPriceType(): PriceType {
  const stored = localStorage.getItem(STORAGE_KEYS.priceType);
  return stored === 'partner' ? 'partner' : 'our';
}

function loadSales(): Sale[] {
  const stored = localStorage.getItem(STORAGE_KEYS.sales);
  if (stored) {
    try {
      return JSON.parse(stored) as Sale[];
    } catch {
      return [];
    }
  }
  return [];
}

function loadSaleReturns(): SaleReturn[] {
  const stored = localStorage.getItem(STORAGE_KEYS.saleReturns);
  if (stored) {
    try {
      return JSON.parse(stored) as SaleReturn[];
    } catch {
      return [];
    }
  }
  return [];
}

function loadStockMovements(): StockMovement[] {
  const stored = localStorage.getItem(STORAGE_KEYS.stockMovements);
  if (stored) {
    try {
      return JSON.parse(stored) as StockMovement[];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeCustomer(raw: Record<string, unknown>): Customer {
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString();
  const legacyNotes = typeof raw.notes === 'string' ? raw.notes : '';
  const legacyAddress = typeof raw.address === 'string' ? raw.address : '';

  return {
    id: String(raw.id ?? `C${Date.now()}`),
    type: raw.type === 'corporate' ? 'corporate' : 'individual',
    name: String(raw.name ?? ''),
    greenleafNumber:
      typeof raw.greenleafNumber === 'string' && raw.greenleafNumber
        ? normalizeGreenleafNumber(raw.greenleafNumber)
        : undefined,
    sponsorName: typeof raw.sponsorName === 'string' ? raw.sponsorName : undefined,
    sponsorGreenleafNumber:
      typeof raw.sponsorGreenleafNumber === 'string' && raw.sponsorGreenleafNumber
        ? normalizeGreenleafNumber(raw.sponsorGreenleafNumber)
        : undefined,
    taxNumber: String(raw.taxNumber ?? ''),
    identityDocumentCountry:
      raw.type === 'corporate'
        ? undefined
        : normalizeIdentityDocumentCountry(raw.identityDocumentCountry),
    identityDocumentCountryName:
      raw.type === 'corporate'
        ? undefined
        : typeof raw.identityDocumentCountryName === 'string' && raw.identityDocumentCountryName.trim()
          ? raw.identityDocumentCountryName.trim()
          : undefined,
    taxOffice: typeof raw.taxOffice === 'string' ? raw.taxOffice : undefined,
    address: legacyAddress || legacyNotes,
    city: String(raw.city ?? ''),
    district: String(raw.district ?? ''),
    postalCode: typeof raw.postalCode === 'string' ? raw.postalCode : undefined,
    country: typeof raw.country === 'string' ? raw.country : 'Türkiye',
    phone: typeof raw.phone === 'string' ? raw.phone : undefined,
    email: typeof raw.email === 'string' ? raw.email : undefined,
    notes: legacyAddress ? legacyNotes : undefined,
    registeredFrom: raw.registeredFrom === 'pos' || raw.registeredFrom === 'admin' ? raw.registeredFrom : undefined,
    registeredBy: typeof raw.registeredBy === 'string' ? raw.registeredBy : undefined,
    crm: normalizeCrmProfile(
      raw.crm as Partial<CustomerCrmProfile> | undefined,
      DEFAULT_CRM_SETTINGS,
    ),
    createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
  };
}

function loadCustomers(): Customer[] {
  const stored = localStorage.getItem(STORAGE_KEYS.customers);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>[];
      return parsed.map(normalizeCustomer);
    } catch {
      return [];
    }
  }
  return [];
}

function loadExpenses(): Expense[] {
  const stored = localStorage.getItem(STORAGE_KEYS.expenses);
  if (stored) {
    try {
      return JSON.parse(stored) as Expense[];
    } catch {
      return [];
    }
  }
  return [];
}

function loadCashHandovers(): CashHandover[] {
  const stored = localStorage.getItem(STORAGE_KEYS.cashHandovers);
  if (stored) {
    try {
      return JSON.parse(stored) as CashHandover[];
    } catch {
      return [];
    }
  }
  return [];
}

function loadCashSessions(): DailyCashSession[] {
  const stored = localStorage.getItem(STORAGE_KEYS.cashSessions);
  if (stored) {
    try {
      return JSON.parse(stored) as DailyCashSession[];
    } catch {
      return [];
    }
  }
  return [];
}

function loadPurchaseInvoices(): PurchaseInvoice[] {
  const stored = localStorage.getItem(STORAGE_KEYS.purchaseInvoices);
  if (stored) {
    try {
      return JSON.parse(stored) as PurchaseInvoice[];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizePosNotesConfig(raw?: AppSettings['posNotes']): AppSettings['posNotes'] {
  const displayDurationSec = raw?.displayDurationSec ?? DEFAULT_POS_NOTES.displayDurationSec;
  const repeatIntervalMin = raw?.repeatIntervalMin ?? DEFAULT_POS_NOTES.repeatIntervalMin;
  return {
    displayDurationSec: Math.min(120, Math.max(3, displayDurationSec)),
    repeatIntervalMin: Math.min(120, Math.max(1, repeatIntervalMin)),
    items: Array.isArray(raw?.items) ? raw.items : [],
  };
}

function normalizeCurrencySettings(raw?: CurrencySettings): CurrencySettings {
  if (!raw) return DEFAULT_CURRENCY_SETTINGS;
  return {
    ...DEFAULT_CURRENCY_SETTINGS,
    ...raw,
    rates: {
      USD: { ...DEFAULT_CURRENCY_SETTINGS.rates.USD, ...raw.rates?.USD },
      KZT: { ...DEFAULT_CURRENCY_SETTINGS.rates.KZT, ...raw.rates?.KZT },
    },
    vakifbank: {
      enabled: raw.vakifbank?.enabled ?? DEFAULT_CURRENCY_SETTINGS.vakifbank?.enabled ?? false,
      clientId: raw.vakifbank?.clientId,
      clientSecret: raw.vakifbank?.clientSecret,
    },
    rateHistory: Array.isArray(raw.rateHistory) ? raw.rateHistory : [],
  };
}

function loadSettings(): AppSettings {
  const stored = localStorage.getItem(STORAGE_KEYS.settings);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as AppSettings;
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        posNotes: normalizePosNotesConfig(parsed.posNotes),
        currency: normalizeCurrencySettings(parsed.currency),
        dashboardWidgets: normalizeDashboardWidgets(parsed.dashboardWidgets),
        paymentReminders: normalizePaymentReminders(parsed.paymentReminders),
        utilityBillSubscriptions: normalizeUtilityBillSubscriptions(parsed.utilityBillSubscriptions),
        utilityBillAutoSync: {
          ...DEFAULT_UTILITY_BILL_AUTO_SYNC,
          ...(parsed.utilityBillAutoSync ?? {}),
        },
        billEmailIngestion: normalizeBillEmailIngestion(parsed.billEmailIngestion),
        soleProprietorshipTaxCalendar: normalizeSoleProprietorshipTaxCalendar(
          parsed.soleProprietorshipTaxCalendar,
        ),
        customExpenseCategories: normalizeCustomExpenseCategories(parsed.customExpenseCategories),
        crm: { ...DEFAULT_CRM_SETTINGS, ...(parsed.crm ?? {}), automationEnabled: parsed.crm?.automationEnabled ?? DEFAULT_CRM_SETTINGS.automationEnabled },
        posCheckout: { ...DEFAULT_POS_CHECKOUT_SETTINGS, ...(parsed.posCheckout ?? {}) },
      };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

function normalizeUser(raw: Record<string, unknown>): PosUser {
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString();
  const role: UserRole = raw.role === 'admin' ? 'admin' : 'cashier';
  let allowedTabs: AppPage[] = Array.isArray(raw.allowedTabs)
    ? raw.allowedTabs.filter((tab): tab is AppPage => typeof tab === 'string' && ALL_APP_PAGES.includes(tab as AppPage))
    : [...DEFAULT_CASHIER_TABS];

  if (role === 'cashier') {
    for (const tab of DEFAULT_CASHIER_TABS) {
      if (!allowedTabs.includes(tab)) allowedTabs.push(tab);
    }
  }

  const user: PosUser = {
    id: String(raw.id ?? `U${Date.now()}`),
    username: String(raw.username ?? '').toLowerCase(),
    displayName: String(raw.displayName ?? raw.username ?? ''),
    passwordHash: String(raw.passwordHash ?? ''),
    role,
    allowedTabs: role === 'admin' ? ALL_APP_PAGES : allowedTabs,
    isActive: raw.isActive !== false,
    isPrimaryAdmin: raw.isPrimaryAdmin === true || String(raw.id) === 'U-admin',
    createdAt,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : createdAt,
    mustChangePassword: raw.mustChangePassword === true,
    pinHash: typeof raw.pinHash === 'string' ? raw.pinHash : undefined,
    totpSecret: typeof raw.totpSecret === 'string' ? raw.totpSecret : undefined,
    totpEnabled: raw.totpEnabled === true,
  };

  return {
    ...user,
    allowedTabs: resolveUserAllowedTabs(user),
  };
}

function loadUsers(): PosUser[] {
  const stored = localStorage.getItem(STORAGE_KEYS.users);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>[];
      if (parsed.length > 0) {
        return parsed.map(normalizeUser);
      }
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_USERS.map((user) => ({ ...user }));
}

function mergeUserLists(remoteUsers: PosUser[], localUsers: PosUser[]): PosUser[] {
  const merged = new Map<string, PosUser>();

  for (const user of remoteUsers) {
    merged.set(user.username, user);
  }

  for (const localUser of localUsers) {
    const remoteUser = merged.get(localUser.username);
    if (!remoteUser) {
      merged.set(localUser.username, localUser);
      continue;
    }

    const localUpdated = new Date(localUser.updatedAt).getTime();
    const remoteUpdated = new Date(remoteUser.updatedAt).getTime();
    if (localUpdated >= remoteUpdated) {
      merged.set(localUser.username, localUser);
    }
  }

  return [...merged.values()];
}

function loadLoginAuditLog(): LoginAuditEntry[] {
  const stored = localStorage.getItem(STORAGE_KEYS.loginAuditLog);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as LoginAuditEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function loadActivityAuditLog(): ActivityAuditEntry[] {
  const stored = localStorage.getItem(STORAGE_KEYS.activityAuditLog);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as ActivityAuditEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function createMovement(
  product: Product,
  type: StockMovementType,
  quantity: number,
  previousStock: number,
  newStock: number,
  note?: string,
  meta?: { saleId?: string; returnId?: string },
): StockMovement {
  return {
    id: `M${Date.now()}-${product.id}`,
    productId: product.id,
    productName: product.name,
    type,
    quantity,
    previousStock,
    newStock,
    note,
    saleId: meta?.saleId,
    returnId: meta?.returnId,
    createdAt: new Date().toISOString(),
  };
}

function createSetMovement(
  set: ProductSet,
  type: StockMovementType,
  quantity: number,
  previousStock: number,
  newStock: number,
  note?: string,
  meta?: { saleId?: string; returnId?: string },
): StockMovement {
  return {
    id: `M${Date.now()}-${set.id}`,
    setId: set.id,
    productName: set.name,
    type,
    quantity,
    previousStock,
    newStock,
    note,
    saleId: meta?.saleId,
    returnId: meta?.returnId,
    createdAt: new Date().toISOString(),
  };
}

function buildLocalSnapshot(
  products: Product[],
  productSets: ProductSet[],
  sales: Sale[],
  saleReturns: SaleReturn[],
  stockMovements: StockMovement[],
  customers: Customer[],
  expenses: Expense[],
  cashHandovers: CashHandover[],
  cashSessions: DailyCashSession[],
  purchaseInvoices: PurchaseInvoice[],
  settings: AppSettings,
  priceType: PriceType,
  users: PosUser[],
  loginAuditLog: LoginAuditEntry[],
  activityAuditLog: ActivityAuditEntry[],
  suppliers: Supplier[],
  customerLedger: CustomerLedgerEntry[],
  supplierLedger: SupplierLedgerEntry[],
  bankAccounts: BankAccount[],
  bankTransactions: BankTransaction[],
  periodClosures: PeriodClosure[],
  cashCountVariances: CashCountVariance[],
  checkNotes: CheckNote[],
  stockAdjustments: StockAdjustment[],
  journalVouchers: JournalVoucher[],
  equityPartners: EquityPartner[],
  capitalContributions: CapitalContribution[],
  crm: CrmPersistedData,
): PersistedStoreSnapshot {
  return {
    updatedAt: new Date().toISOString(),
    products: products.map(({ imageUrl: _, ...rest }) => rest),
    productSets,
    sales,
    saleReturns,
    stockMovements,
    customers,
    expenses,
    cashHandovers,
    cashSessions,
    purchaseInvoices,
    settings,
    priceType,
    users,
    loginAuditLog,
    activityAuditLog,
    suppliers,
    customerLedger,
    supplierLedger,
    bankAccounts,
    bankTransactions,
    periodClosures,
    cashCountVariances,
    checkNotes,
    stockAdjustments,
    journalVouchers,
    equityPartners,
    capitalContributions,
    crm,
  };
}

function buildSnapshotFromStorage(): PersistedStoreSnapshot {
  const accounting = loadAccountingSnapshot();
  return {
    updatedAt: new Date().toISOString(),
    products: loadProducts().map(({ imageUrl: _, ...rest }) => rest),
    productSets: loadProductSets(),
    sales: loadSales(),
    saleReturns: loadSaleReturns(),
    stockMovements: loadStockMovements(),
    customers: loadCustomers(),
    expenses: loadExpenses(),
    cashHandovers: loadCashHandovers(),
    cashSessions: loadCashSessions(),
    purchaseInvoices: loadPurchaseInvoices(),
    settings: loadSettings(),
    priceType: loadPriceType(),
    users: loadUsers(),
    loginAuditLog: loadLoginAuditLog(),
    activityAuditLog: loadActivityAuditLog(),
    ...accounting,
    crm: loadCrmData(),
  };
}

export function useStore() {
  const [products, setProducts] = useState<Product[]>(loadProducts);
  const [productSets, setProductSets] = useState<ProductSet[]>(loadProductSets);
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [heldPosSales, setHeldPosSales] = useState<HeldPosSale[]>(loadHeldPosSales);
  const [priceType, setPriceType] = useState<PriceType>(loadPriceType);
  const [sales, setSales] = useState<Sale[]>(() => repairSaleCustomerLinks(loadSales(), loadCustomers()));
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>(loadSaleReturns);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>(loadStockMovements);
  const [customers, setCustomers] = useState<Customer[]>(loadCustomers);
  const [expenses, setExpenses] = useState<Expense[]>(loadExpenses);
  const [cashHandovers, setCashHandovers] = useState<CashHandover[]>(loadCashHandovers);
  const [cashSessions, setCashSessions] = useState<DailyCashSession[]>(loadCashSessions);
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>(loadPurchaseInvoices);
  const initialAccounting = loadAccountingSnapshot();
  const [suppliers, setSuppliers] = useState<Supplier[]>(initialAccounting.suppliers);
  const [customerLedger, setCustomerLedger] = useState<CustomerLedgerEntry[]>(initialAccounting.customerLedger);
  const [supplierLedger, setSupplierLedger] = useState<SupplierLedgerEntry[]>(initialAccounting.supplierLedger);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(initialAccounting.bankAccounts);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(initialAccounting.bankTransactions);
  const [periodClosures, setPeriodClosures] = useState<PeriodClosure[]>(initialAccounting.periodClosures);
  const [cashCountVariances, setCashCountVariances] = useState<CashCountVariance[]>(initialAccounting.cashCountVariances);
  const [checkNotes, setCheckNotes] = useState<CheckNote[]>(initialAccounting.checkNotes);
  const [stockAdjustments, setStockAdjustments] = useState<StockAdjustment[]>(initialAccounting.stockAdjustments);
  const [journalVouchers, setJournalVouchers] = useState<JournalVoucher[]>(initialAccounting.journalVouchers);
  const [equityPartners, setEquityPartners] = useState<EquityPartner[]>(initialAccounting.equityPartners);
  const [capitalContributions, setCapitalContributions] = useState<CapitalContribution[]>(initialAccounting.capitalContributions);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [users, setUsers] = useState<PosUser[]>(loadUsers);
  const [loginAuditLog, setLoginAuditLog] = useState<LoginAuditEntry[]>(loadLoginAuditLog);
  const [activityAuditLog, setActivityAuditLog] = useState<ActivityAuditEntry[]>(loadActivityAuditLog);
  const [authSession, setAuthSession] = useState<AuthSession | null>(loadAuthSession);
  const [saleGreenleafNumber, setSaleGreenleafNumber] = useState('');
  const [saleCustomerId, setSaleCustomerId] = useState<string | undefined>();
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleMode, setSaleMode] = useState<SaleMode>('retail');
  const [costProfitRevealed, setCostProfitRevealed] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'loading' | 'synced' | 'local-only'>('loading');
  const [crmData, setCrmData] = useState<CrmPersistedData>(loadCrmData);
  const [saleCouponCode, setSaleCouponCode] = useState('');
  const [saleLoyaltyPointsToRedeem, setSaleLoyaltyPointsToRedeem] = useState(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const irsaliyeStockMigrationRef = useRef(false);

  const crmSettings = getCrmSettings(settings);

  const buildCurrentSnapshot = useCallback((overrides?: {
    users?: PosUser[];
    cashSessions?: DailyCashSession[];
  }): PersistedStoreSnapshot => {
    const { products: irsaliyeProducts } = applyIrsaliyeStockToProducts(products);
    return buildLocalSnapshot(
      irsaliyeProducts,
      productSets,
      sales,
      saleReturns,
      stockMovements,
      customers,
      expenses,
      cashHandovers,
      overrides?.cashSessions ?? cashSessions,
      purchaseInvoices,
      settings,
      priceType,
      overrides?.users ?? users,
      loginAuditLog,
      activityAuditLog,
      suppliers,
      customerLedger,
      supplierLedger,
      bankAccounts,
      bankTransactions,
      periodClosures,
      cashCountVariances,
      checkNotes,
      stockAdjustments,
      journalVouchers,
      equityPartners,
      capitalContributions,
      crmData,
    );
  }, [
    products, productSets, sales, saleReturns, stockMovements, customers, expenses,
    cashHandovers, cashSessions, purchaseInvoices, settings, priceType, users,
    loginAuditLog, activityAuditLog, suppliers, customerLedger, supplierLedger,
    bankAccounts, bankTransactions, periodClosures, cashCountVariances, checkNotes, stockAdjustments,
    journalVouchers, equityPartners, capitalContributions, crmData,
  ]);

  const applySnapshot = useCallback((snapshot: PersistedStoreSnapshot) => {
    setProducts(mergeWithSeed(snapshot.products));
    setProductSets(mergeProductSets(snapshot.productSets));
    setSales(repairSaleCustomerLinks(snapshot.sales ?? [], snapshot.customers ?? []));
    setSaleReturns(snapshot.saleReturns ?? []);
    setStockMovements(snapshot.stockMovements ?? []);
    setCustomers(snapshot.customers ?? []);
    setExpenses(snapshot.expenses ?? []);
    const localHandovers = loadCashHandovers();
    const remoteHandovers = snapshot.cashHandovers;
    setCashHandovers(
      remoteHandovers === undefined
        ? localHandovers
        : remoteHandovers.length === 0 && localHandovers.length > 0
          ? localHandovers
          : remoteHandovers,
    );
    setCashSessions(snapshot.cashSessions ?? []);
    setPurchaseInvoices(snapshot.purchaseInvoices ?? []);
    const accounting = mergeAccountingFromPersisted(snapshot);
    setSuppliers(accounting.suppliers);
    setCustomerLedger(accounting.customerLedger);
    setSupplierLedger(accounting.supplierLedger);
    setBankAccounts(accounting.bankAccounts);
    setBankTransactions(accounting.bankTransactions);
    setPeriodClosures(accounting.periodClosures);
    setCashCountVariances(accounting.cashCountVariances);
    setCheckNotes(accounting.checkNotes);
    setStockAdjustments(accounting.stockAdjustments);
    setJournalVouchers(accounting.journalVouchers);
    setEquityPartners(accounting.equityPartners);
    setCapitalContributions(accounting.capitalContributions);
    setCrmData(normalizeCrmData(snapshot.crm));
    saveCrmDataLocal(normalizeCrmData(snapshot.crm));
    setSettings({
      ...DEFAULT_SETTINGS,
      ...(snapshot.settings ?? {}),
      posNotes: normalizePosNotesConfig(snapshot.settings?.posNotes),
      currency: normalizeCurrencySettings(snapshot.settings?.currency),
      dashboardWidgets: normalizeDashboardWidgets(snapshot.settings?.dashboardWidgets),
      paymentReminders: normalizePaymentReminders(snapshot.settings?.paymentReminders),
      utilityBillSubscriptions: normalizeUtilityBillSubscriptions(snapshot.settings?.utilityBillSubscriptions),
      utilityBillAutoSync: {
        ...DEFAULT_UTILITY_BILL_AUTO_SYNC,
        ...(snapshot.settings?.utilityBillAutoSync ?? {}),
      },
      billEmailIngestion: normalizeBillEmailIngestion(snapshot.settings?.billEmailIngestion),
      soleProprietorshipTaxCalendar: normalizeSoleProprietorshipTaxCalendar(
        snapshot.settings?.soleProprietorshipTaxCalendar,
      ),
      customExpenseCategories: normalizeCustomExpenseCategories(
        snapshot.settings?.customExpenseCategories,
      ),
      crm: { ...DEFAULT_CRM_SETTINGS, ...(snapshot.settings?.crm ?? {}) },
      posCheckout: { ...DEFAULT_POS_CHECKOUT_SETTINGS, ...(snapshot.settings?.posCheckout ?? {}) },
    });
    if (snapshot.priceType) setPriceType(snapshot.priceType);
    if (snapshot.users?.length) {
      const remoteUsers = snapshot.users.map((user) => normalizeUser(user as unknown as Record<string, unknown>));
      const localUsers = loadUsers();
      setUsers(mergeUserLists(remoteUsers, localUsers));
    } else {
      setUsers((prev) => (prev.length > 0 ? prev : DEFAULT_USERS.map((user) => ({ ...user }))));
    }
    if (snapshot.loginAuditLog?.length) {
      setLoginAuditLog(snapshot.loginAuditLog);
    }
    if (snapshot.activityAuditLog?.length) {
      setActivityAuditLog(snapshot.activityAuditLog);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const localSnapshot = buildSnapshotFromStorage();
      const remote = await fetchStoreSnapshot();

      if (cancelled) return;

      if (remote && hasPersistedStoreData(remote)) {
        const remoteUsers = (remote.users ?? []).map((user) => normalizeUser(user as unknown as Record<string, unknown>));
        const localUsers = loadUsers();
        const mergedUsers = mergeUserLists(remoteUsers, localUsers);
        const { products: migratedRemoteProducts } = applyIrsaliyeStockToProducts(remote.products ?? []);
        const mergedSnapshot = {
          ...(mergedUsers.length !== remoteUsers.length
            ? { ...remote, users: mergedUsers, updatedAt: new Date().toISOString() }
            : remote),
          products: migratedRemoteProducts,
          updatedAt: new Date().toISOString(),
        };

        applySnapshot(mergedSnapshot);
        await saveStoreSnapshot(mergedSnapshot);
        setSyncStatus('synced');
      } else if (hasPersistedStoreData(localSnapshot)) {
        const { products: migratedLocal } = applyIrsaliyeStockToProducts(localSnapshot.products ?? []);
        const localFixed = {
          ...localSnapshot,
          products: migratedLocal,
          updatedAt: new Date().toISOString(),
        };
        setProducts(mergeWithSeed(migratedLocal));
        const saved = await saveStoreSnapshot(localFixed);
        setSyncStatus(saved ? 'synced' : 'local-only');
      } else {
        setSyncStatus('synced');
      }

      setSyncReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [applySnapshot]);

  useEffect(() => {
    if (!syncReady) return;
    const toSave = products.map(({ imageUrl: _, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(toSave));
  }, [products, syncReady]);

  useEffect(() => {
    if (!syncReady) return;
    localStorage.setItem(STORAGE_KEYS.productSets, JSON.stringify(productSets));
  }, [productSets, syncReady]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.priceType, priceType);
  }, [priceType]);

  useEffect(() => {
    if (!syncReady) return;
    setSales((prev) => {
      const next = repairSaleCustomerLinks(prev, customers);
      return next === prev ? prev : next;
    });
  }, [customers, syncReady]);

  useEffect(() => {
    if (!syncReady) return;
    setCustomerLedger((prev) => syncCustomerLedgerFromSales(sales, customers, prev));
  }, [sales, customers, syncReady]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.sales, JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.saleReturns, JSON.stringify(saleReturns));
  }, [saleReturns]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.stockMovements, JSON.stringify(stockMovements));
  }, [stockMovements]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.customers, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    if (!syncReady) return;
    saveCrmDataLocal(crmData);
  }, [crmData, syncReady]);

  useEffect(() => {
    if (!syncReady) return;
    saveHeldPosSales(heldPosSales);
  }, [heldPosSales, syncReady]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cashHandovers, JSON.stringify(cashHandovers));
  }, [cashHandovers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.cashSessions, JSON.stringify(cashSessions));
  }, [cashSessions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.purchaseInvoices, JSON.stringify(purchaseInvoices));
  }, [purchaseInvoices]);

  useEffect(() => {
    if (!syncReady) return;
    setCashSessions((prev) => {
      const next = reconcileCashSessions(prev, sales, saleReturns, expenses, cashHandovers, journalVouchers);
      return JSON.stringify(next) === JSON.stringify(prev) ? prev : next;
    });
  }, [syncReady, sales, saleReturns, expenses, cashHandovers, journalVouchers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.loginAuditLog, JSON.stringify(loginAuditLog));
  }, [loginAuditLog]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activityAuditLog, JSON.stringify(activityAuditLog));
  }, [activityAuditLog]);

  useEffect(() => {
    saveAccountingSnapshot({
      suppliers,
      customerLedger,
      supplierLedger,
      bankAccounts,
      bankTransactions,
      periodClosures,
      cashCountVariances,
      checkNotes,
      stockAdjustments,
      journalVouchers,
      equityPartners,
      capitalContributions,
    });
  }, [
    suppliers, customerLedger, supplierLedger, bankAccounts, bankTransactions,
    periodClosures, cashCountVariances, checkNotes, stockAdjustments, journalVouchers,
    equityPartners, capitalContributions,
  ]);

  useEffect(() => {
    if (!syncReady) return;

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const snapshot = buildCurrentSnapshot();
      const saved = await saveStoreSnapshot(snapshot);
      setSyncStatus(saved ? 'synced' : 'local-only');
    }, 700);

    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [buildCurrentSnapshot, syncReady]);

  useEffect(() => {
    if (!authSession) return;
    const user = users.find((item) => item.id === authSession.userId && item.isActive);
    if (!user) {
      clearAuthSession();
      setAuthSession(null);
      return;
    }
    const freshSession = buildAuthSession(user, authSession.sessionId);
    const tabsChanged =
      freshSession.allowedTabs.join('|') !== authSession.allowedTabs.join('|')
      || freshSession.displayName !== authSession.displayName
      || freshSession.role !== authSession.role;
    if (tabsChanged) {
      saveAuthSession(freshSession);
      setAuthSession(freshSession);
    }
  }, [users, authSession]);

  useEffect(() => {
    setPriceType(settings.defaultPriceType);
  }, [settings.defaultPriceType]);

  const salePriceType = resolveSalePriceType(saleGreenleafNumber, saleMode);

  const recalcCartItem = useCallback((product: Product, item: CartItem, priceType: PriceType): CartItem => ({
    ...item,
    priceType,
    unitPrice: getCartUnitPrice(product, item.quantity, priceType),
  }), []);

  const pushActivityEntry = useCallback((entry: Omit<ActivityAuditEntry, 'id' | 'createdAt'>) => {
    const record: ActivityAuditEntry = {
      ...entry,
      id: `AA${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    };
    setActivityAuditLog((prev) => [record, ...prev].slice(0, MAX_ACTIVITY_AUDIT_ENTRIES));
  }, []);

  const logActivity = useCallback((
    session: AuthSession,
    action: ActivityAction,
    summary: string,
    meta?: ActivityAuditEntry['meta'],
  ) => {
    if (!session.sessionId) return;
    pushActivityEntry({
      sessionId: session.sessionId,
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      action,
      summary,
      meta,
    });
  }, [pushActivityEntry]);

  const lastTrackedPageRef = useRef<AppPage | null>(null);

  const trackPageView = useCallback((page: AppPage) => {
    if (!authSession?.sessionId) return;
    if (lastTrackedPageRef.current === page) return;
    lastTrackedPageRef.current = page;
    logActivity(authSession, 'page_view', `${getPageLabel(page)} sekmesine geçildi`, { page });
  }, [authSession, logActivity]);

  const getActivitiesForLogin = useCallback((entry: LoginAuditEntry): ActivityAuditEntry[] => {
    if (!entry.success) return [];
    if (entry.sessionId) {
      return activityAuditLog.filter((item) => item.sessionId === entry.sessionId);
    }
    const loginTime = new Date(entry.createdAt).getTime();
    const nextLogin = loginAuditLog
      .filter(
        (item) =>
          item.success
          && item.userId === entry.userId
          && new Date(item.createdAt).getTime() > loginTime,
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    const endTime = nextLogin ? new Date(nextLogin.createdAt).getTime() : Number.POSITIVE_INFINITY;
    return activityAuditLog.filter((item) => {
      if (item.userId !== entry.userId) return false;
      const activityTime = new Date(item.createdAt).getTime();
      return activityTime >= loginTime && activityTime < endTime;
    });
  }, [activityAuditLog, loginAuditLog]);

  useEffect(() => {
    setCart((prev) => {
      if (prev.length === 0) return prev;

      const sampleItems = prev.filter((item) => item.priceType === 'sample');
      const productItems = prev.filter((item) => item.productId != null && item.priceType !== 'sample');
      const setItems = prev.filter((item) => item.setId != null && item.priceType !== 'sample');

      const mergedProducts = new Map<number, CartItem>();
      for (const item of productItems) {
        const product = products.find((p) => p.id === item.productId);
        if (!product) continue;

        const nextItem = recalcCartItem(product, item, salePriceType);
        const existing = mergedProducts.get(item.productId!);
        if (existing) {
          mergedProducts.set(item.productId!, {
            ...existing,
            quantity: existing.quantity + nextItem.quantity,
            priceType: salePriceType,
            unitPrice: getCartUnitPrice(product, existing.quantity + nextItem.quantity, salePriceType),
          });
        } else {
          mergedProducts.set(item.productId!, nextItem);
        }
      }

      const mergedSets = setItems.map((item) => {
        const set = productSets.find((s) => s.id === item.setId);
        if (!set) return item;
        return {
          ...item,
          priceType: salePriceType,
          unitPrice: getProductSetSalePrice(set, salePriceType, item.quantity),
        };
      });

      return [...Array.from(mergedProducts.values()), ...mergedSets, ...sampleItems];
    });
  }, [salePriceType, products, productSets, recalcCartItem]);

  const recordStockChange = useCallback(
    (
      productId: number,
      newStock: number,
      type: StockMovementType,
      quantity: number,
      note?: string,
    ) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      const movement = createMovement(product, type, quantity, product.stock, newStock, note);
      setStockMovements((prev) => [movement, ...prev]);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: newStock } : p)),
      );
      localStorage.setItem(STORAGE_KEYS.stockInitialized, '1');
      if (authSession) {
        logActivity(authSession, 'stock_adjust', `Stok güncellendi: ${product.name}`, {
          urun: product.name,
          miktar: quantity,
          tip: type,
        });
      }
    },
    [products, authSession, logActivity],
  );

  const setProductStock = useCallback(
    (productId: number, stock: number, note?: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      const safeStock = Math.max(0, Math.floor(stock));
      if (safeStock === product.stock) return;
      const delta = safeStock - product.stock;
      const type = delta >= 0 ? 'in' : 'out';
      recordStockChange(productId, safeStock, type, Math.abs(delta), note ?? 'Stok güncelleme');
    },
    [products, recordStockChange],
  );

  const adjustProductStock = useCallback(
    (productId: number, delta: number, note?: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;
      const newStock = Math.max(0, product.stock + delta);
      if (newStock === product.stock) return;
      const type = delta >= 0 ? 'in' : 'out';
      recordStockChange(productId, newStock, type, Math.abs(delta), note);
    },
    [products, recordStockChange],
  );

  const setProductSampleStock = useCallback(
    (productId: number, sampleStock: number, note?: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product || !product.isSample) return;
      const safeStock = Math.max(0, Math.floor(sampleStock));
      const prevSample = product.sampleStock ?? 0;
      if (safeStock === prevSample) return;
      const movement = createMovement(
        product,
        'sample',
        Math.abs(safeStock - prevSample),
        prevSample,
        safeStock,
        note ?? 'Numune stok güncelleme',
      );
      setStockMovements((prev) => [movement, ...prev]);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, sampleStock: safeStock } : p)),
      );
      if (authSession) {
        logActivity(authSession, 'stock_adjust', `Numune stok güncellendi: ${product.name}`, {
          urun: product.name,
          miktar: Math.abs(safeStock - prevSample),
          tip: 'sample',
        });
      }
    },
    [products, authSession, logActivity],
  );

  const updateProductBarcode = useCallback((productId: number, barcode: string) => {
    const trimmed = barcode.trim();
    setProducts((prev) =>
      prev.map((p) => (
        p.id === productId ? { ...p, barcode: trimmed || undefined } : p
      )),
    );
  }, []);

  const setProductSampleFlag = useCallback((productId: number, isSample: boolean) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        return {
          ...p,
          isSample,
          sampleStock: isSample ? (p.sampleStock ?? 0) : 0,
        };
      }),
    );
  }, []);

  const saveProductSet = useCallback((data: {
    id?: string;
    stockCode: string;
    name: string;
    description?: string;
    items: ProductSetItem[];
    ourPriceWithVat: number;
    partnerPriceWithVat: number;
    wholesalePrices?: WholesalePrices;
    isActive?: boolean;
  }) => {
    const now = new Date().toISOString();
    const trimmedCode = data.stockCode.trim();
    const trimmedName = data.name.trim();
    if (!trimmedCode || !trimmedName || data.items.length === 0) return null;

    const existing = data.id ? productSets.find((set) => set.id === data.id) : undefined;
    const id = data.id ?? `SET-${Date.now().toString(36).toUpperCase()}`;
    const nextSet: ProductSet = {
      id,
      stockCode: trimmedCode,
      name: trimmedName,
      description: data.description?.trim() || undefined,
      items: data.items.filter((item) => item.quantity > 0),
      stock: existing?.stock ?? 0,
      ourPriceWithVat: Math.max(0, data.ourPriceWithVat),
      partnerPriceWithVat: Math.max(0, data.partnerPriceWithVat),
      wholesalePrices: data.wholesalePrices,
      isActive: data.isActive ?? true,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    setProductSets((prev) => {
      const index = prev.findIndex((set) => set.id === id);
      if (index >= 0) {
        const updated = [...prev];
        updated[index] = nextSet;
        return updated;
      }
      return [nextSet, ...prev];
    });

    if (authSession) {
      logActivity(authSession, 'settings_update', existing ? `Set güncellendi: ${nextSet.name}` : `Set oluşturuldu: ${nextSet.name}`, {
        set: nextSet.id,
      });
    }

    return nextSet;
  }, [productSets, authSession, logActivity]);

  const removeProductSet = useCallback((setId: string) => {
    const target = productSets.find((set) => set.id === setId);
    setProductSets((prev) => prev.filter((set) => set.id !== setId));
    if (authSession && target) {
      logActivity(authSession, 'settings_update', `Set silindi: ${target.name}`, { set: setId });
    }
  }, [productSets, authSession, logActivity]);

  const assembleProductSet = useCallback((setId: string, quantity: number, note?: string): { ok: boolean; message?: string } => {
    const set = productSets.find((item) => item.id === setId);
    const safeQty = Math.max(0, Math.floor(quantity));
    if (!set || safeQty <= 0) return { ok: false, message: 'Geçersiz set veya miktar' };
    if (!set.items.length) return { ok: false, message: 'Set içeriği boş' };

    for (const item of set.items) {
      const product = products.find((p) => p.id === item.productId);
      const needed = item.quantity * safeQty;
      if (!product || product.stock < needed) {
        return {
          ok: false,
          message: `${product?.name ?? `Ürün #${item.productId}`} için yeterli stok yok (gerekli: ${needed})`,
        };
      }
    }

    const componentMovements: StockMovement[] = [];
    setProducts((prev) =>
      prev.map((product) => {
        const component = set.items.find((item) => item.productId === product.id);
        if (!component) return product;
        const needed = component.quantity * safeQty;
        const newStock = Math.max(0, product.stock - needed);
        componentMovements.push(
          createMovement(product, 'out', needed, product.stock, newStock, note ?? `Set montajı: ${set.name}`),
        );
        return { ...product, stock: newStock };
      }),
    );

    const prevSetStock = set.stock;
    const newSetStock = prevSetStock + safeQty;
    const setMovement = createSetMovement(
      set,
      'set_assembly',
      safeQty,
      prevSetStock,
      newSetStock,
      note ?? 'Set montajı',
    );

    setProductSets((prev) =>
      prev.map((item) => (item.id === setId ? { ...item, stock: newSetStock, updatedAt: new Date().toISOString() } : item)),
    );
    setStockMovements((prev) => [setMovement, ...componentMovements, ...prev]);

    if (authSession) {
      logActivity(authSession, 'stock_adjust', `${set.name} setinden ${safeQty} adet monte edildi`, {
        set: setId,
        miktar: safeQty,
      });
    }

    return { ok: true };
  }, [productSets, products, authSession, logActivity]);

  const adjustProductSetStock = useCallback((setId: string, delta: number, note?: string) => {
    const set = productSets.find((item) => item.id === setId);
    if (!set) return;
    const newStock = Math.max(0, set.stock + delta);
    if (newStock === set.stock) return;
    const type = delta >= 0 ? 'in' : 'out';
    const movement = createSetMovement(set, type, Math.abs(delta), set.stock, newStock, note ?? 'Set stok işlemi');
    setProductSets((prev) =>
      prev.map((item) => (item.id === setId ? { ...item, stock: newStock, updatedAt: new Date().toISOString() } : item)),
    );
    setStockMovements((prev) => [movement, ...prev]);
    if (authSession) {
      logActivity(authSession, 'stock_adjust', `Set stok güncellendi: ${set.name}`, {
        set: setId,
        miktar: Math.abs(delta),
        tip: type,
      });
    }
  }, [productSets, authSession, logActivity]);

  const setBulkStock = useCallback(
    (stock: number, note?: string) => {
      const safeStock = Math.max(0, Math.floor(stock));
      const movements: StockMovement[] = [];
      const updated = products.map((p) => {
        if (p.stock === safeStock) return p;
        movements.push(
          createMovement(
            p,
            safeStock >= p.stock ? 'in' : 'out',
            Math.abs(safeStock - p.stock),
            p.stock,
            safeStock,
            note ?? 'Toplu stok girişi',
          ),
        );
        return { ...p, stock: safeStock };
      });
      setProducts(updated);
      if (movements.length > 0) {
        setStockMovements((prev) => [...movements, ...prev]);
        localStorage.setItem(STORAGE_KEYS.stockInitialized, '1');
        if (authSession) {
          logActivity(authSession, 'stock_bulk', `Toplu stok güncellendi: ${safeStock} adet`, {
            miktar: safeStock,
            urun: movements.length,
          });
        }
      }
    },
    [products, authSession, logActivity],
  );

  const getUnitPrice = useCallback(
    (product: Product, quantity = 1, type: PriceType = salePriceType) =>
      getCartUnitPrice(product, quantity, type),
    [salePriceType],
  );

  const selectSaleCustomer = useCallback(
    (customerId: string | null) => {
      if (!customerId) {
        setSaleCustomerId(undefined);
        return;
      }
      const customer = customers.find((c) => c.id === customerId);
      setSaleCustomerId(customerId);
      setSaleGreenleafNumber(customer?.greenleafNumber ?? '');
      setSaleCustomerName(customer?.name ?? '');
    },
    [customers],
  );

  const updateSaleGreenleafNumber = useCallback((value: string) => {
    const typing = parseGreenleafNumberInput(value);
    setSaleGreenleafNumber(typing);
    const normalized = normalizeGreenleafNumber(typing);
    if (!normalized) {
      setSaleCustomerId(undefined);
      return;
    }
    const matched = customers.find(
      (c) => normalizeGreenleafNumber(c.greenleafNumber ?? '') === normalized,
    );
    if (matched) {
      setSaleCustomerId(matched.id);
      setSaleCustomerName(matched.name);
    } else {
      setSaleCustomerId(undefined);
    }
  }, [customers]);

  const updateSaleCustomerName = useCallback((value: string) => {
    setSaleCustomerName(value);
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    const exactMatch = customers.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    if (exactMatch) {
      setSaleCustomerId(exactMatch.id);
      if (exactMatch.greenleafNumber) {
        setSaleGreenleafNumber(exactMatch.greenleafNumber);
      }
    }
  }, [customers]);

  const clearSaleCustomer = useCallback(() => {
    setSaleGreenleafNumber('');
    setSaleCustomerId(undefined);
    setSaleCustomerName('');
    setSaleMode('retail');
  }, []);

  const changeSaleMode = useCallback((mode: SaleMode) => {
    setSaleMode(mode);
  }, []);

  const toggleCostProfitReveal = useCallback(() => {
    setCostProfitRevealed((prev) => !prev);
  }, []);

  const addSampleToCart = useCallback((productId: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product?.isSample) return;
    const maxQty = product.sampleStock ?? 0;
    if (maxQty <= 0) return;

    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId && item.priceType === 'sample');
      if (existing) {
        if (existing.quantity >= maxQty) return prev;
        return prev.map((item) =>
          item.productId === productId && item.priceType === 'sample'
            ? { ...item, quantity: item.quantity + 1, unitPrice: 0 }
            : item,
        );
      }
      return [
        ...prev,
        { productId, quantity: 1, priceType: 'sample', unitPrice: 0 },
      ];
    });
  }, [products]);

  const addToCart = useCallback(
    (productId: number) => {
      const product = products.find((p) => p.id === productId);
      if (!product || product.isSample || product.stock <= 0) return;

      setCart((prev) => {
        const existing = prev.find((item) => item.productId === productId && item.priceType === salePriceType);
        if (existing) {
          if (existing.quantity >= product.stock) return prev;
          const nextQuantity = existing.quantity + 1;
          const unitPrice = getUnitPrice(product, nextQuantity);
          return prev.map((item) =>
            item.productId === productId && item.priceType === salePriceType
              ? { ...item, quantity: nextQuantity, unitPrice }
              : item,
          );
        }
        return [
          ...prev,
          {
            productId,
            quantity: 1,
            priceType: salePriceType,
            unitPrice: getUnitPrice(product, 1),
          },
        ];
      });
    },
    [products, salePriceType, getUnitPrice],
  );

  const addSetToCart = useCallback(
    (setId: string) => {
      const set = productSets.find((s) => s.id === setId);
      if (!set || !set.isActive || set.stock <= 0) return;

      setCart((prev) => {
        const existing = prev.find((item) => item.setId === setId && item.priceType === salePriceType);
        if (existing) {
          if (existing.quantity >= set.stock) return prev;
          const nextQuantity = existing.quantity + 1;
          const unitPrice = getProductSetSalePrice(set, salePriceType, nextQuantity);
          return prev.map((item) =>
            item.setId === setId && item.priceType === salePriceType
              ? { ...item, quantity: nextQuantity, unitPrice }
              : item,
          );
        }
        return [
          ...prev,
          {
            setId,
            quantity: 1,
            priceType: salePriceType,
            unitPrice: getProductSetSalePrice(set, salePriceType, 1),
          },
        ];
      });
    },
    [productSets, salePriceType],
  );

  const scanAddToCart = useCallback((raw: string): BarcodeScanApplyResult => {
    const resolved = resolveBarcodeScan(raw, products, productSets);
    if (resolved.kind === 'failure') {
      return { ok: false, reason: resolved.reason, message: resolved.message };
    }
    if (resolved.kind === 'product') {
      const product = products.find((p) => p.id === resolved.productId);
      if (!product || product.stock <= 0) {
        return { ok: false, reason: 'out_of_stock', message: resolved.label + ' — stok yok' };
      }
      const existing = cart.find((item) => item.productId === resolved.productId && item.priceType === salePriceType);
      if (existing && existing.quantity >= product.stock) {
        return {
          ok: false,
          reason: 'out_of_stock',
          message: `${resolved.label} — maksimum stok (${product.stock})`,
        };
      }
      addToCart(resolved.productId);
      return { ok: true, kind: 'product', label: resolved.label, productId: resolved.productId };
    }
    const set = productSets.find((s) => s.id === resolved.setId);
    if (!set || set.stock <= 0) {
      return { ok: false, reason: 'out_of_stock', message: resolved.label + ' — stok yok' };
    }
    const existingSet = cart.find((item) => item.setId === resolved.setId && item.priceType === salePriceType);
    if (existingSet && existingSet.quantity >= set.stock) {
      return {
        ok: false,
        reason: 'out_of_stock',
        message: `${resolved.label} — maksimum set stok (${set.stock})`,
      };
    }
    addSetToCart(resolved.setId);
    return { ok: true, kind: 'set', label: resolved.label, setId: resolved.setId };
  }, [products, productSets, cart, salePriceType, addToCart, addSetToCart]);

  const updateCartQuantity = useCallback(
    (productId: number, priceType: PriceType, quantity: number) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      if (quantity <= 0) {
        setCart((prev) => prev.filter((item) => !(item.productId === productId && item.priceType === priceType)));
        return;
      }

      const isSampleLine = priceType === 'sample';
      if (isSampleLine && !product.isSample) return;

      const maxQty = isSampleLine ? (product.sampleStock ?? 0) : product.stock;
      const safeQty = Math.min(quantity, maxQty);
      const unitPrice = isSampleLine ? 0 : getUnitPrice(product, safeQty);
      setCart((prev) =>
        prev.map((item) =>
          item.productId === productId && item.priceType === priceType
            ? { ...item, quantity: safeQty, unitPrice, priceType }
            : item,
        ),
      );
    },
    [products, getUnitPrice],
  );

  const updateSetCartQuantity = useCallback(
    (setId: string, priceType: PriceType, quantity: number) => {
      const set = productSets.find((s) => s.id === setId);
      if (!set) return;

      if (quantity <= 0) {
        setCart((prev) => prev.filter((item) => !(item.setId === setId && item.priceType === priceType)));
        return;
      }

      const safeQty = Math.min(quantity, set.stock);
      const unitPrice = getProductSetSalePrice(set, priceType, safeQty);
      setCart((prev) =>
        prev.map((item) =>
          item.setId === setId && item.priceType === priceType
            ? { ...item, quantity: safeQty, unitPrice, priceType }
            : item,
        ),
      );
    },
    [productSets],
  );

  const removeFromCart = useCallback((productId: number, priceType: PriceType) => {
    setCart((prev) => prev.filter((item) => !(item.productId === productId && item.priceType === priceType)));
  }, []);

  const removeSetFromCart = useCallback((setId: string, priceType: PriceType) => {
    setCart((prev) => prev.filter((item) => !(item.setId === setId && item.priceType === priceType)));
  }, []);

  const clearCart = useCallback(() => {
    if (authSession && cart.length > 0) {
      logActivity(authSession, 'cart_clear', `Sepet temizlendi (${cart.length} kalem)`);
    }
    setCart([]);
    clearSaleCustomer();
  }, [clearSaleCustomer, authSession, cart, logActivity]);

  const addCustomer = useCallback((data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const customer: Customer = {
      ...data,
      id: `C${Date.now()}`,
      createdAt: now,
      updatedAt: now,
    };
    setCustomers((prev) => [customer, ...prev]);
    if (authSession) {
      logActivity(authSession, 'customer_add', `Müşteri eklendi: ${customer.name}`, { musteri: customer.name });
    }
    return customer;
  }, [authSession, logActivity]);

  const addQuickCustomer = useCallback((
    name: string,
    greenleafNumber: string,
    registeredBy?: string,
  ): Customer | null => {
    const error = validateQuickCustomerInput({ name, greenleafNumber }, { existingCustomers: customers });
    if (error) {
      return null;
    }

    const normalizedGl = normalizeGreenleafNumber(greenleafNumber);
    if (!normalizedGl) return null;

    const existing = customers.find(
      (c) => normalizeGreenleafNumber(c.greenleafNumber ?? '') === normalizedGl,
    );
    if (existing) return existing;

    const payload = buildQuickCustomerPayload(name, greenleafNumber, registeredBy);
    return addCustomer(payload);
  }, [customers, addCustomer]);

  const updateCustomer = useCallback((id: string, data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, ...data, updatedAt: new Date().toISOString() }
          : c,
      ),
    );
    if (authSession) {
      logActivity(authSession, 'customer_update', `Müşteri güncellendi: ${data.name}`, { musteri: data.name });
    }
  }, [authSession, logActivity]);

  const removeCustomer = useCallback((id: string) => {
    const customer = customers.find((c) => c.id === id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    if (authSession && customer) {
      logActivity(authSession, 'customer_remove', `Müşteri silindi: ${customer.name}`, { musteri: customer.name });
    }
  }, [customers, authSession, logActivity]);

  const addExpense = useCallback((description: string, amount: number, category: ExpenseCategory) => {
    const businessDate = getOperationalBusinessDateKey(cashSessions);
    const expense: Expense = {
      id: `E${Date.now()}`,
      description,
      amount: Math.max(0, amount),
      category,
      businessDate,
      createdAt: new Date().toISOString(),
    };
    setExpenses((prev) => [expense, ...prev]);
    if (authSession) {
      logActivity(authSession, 'expense_add', `Gider eklendi: ${formatCurrencyTry(expense.amount)}`, {
        aciklama: description,
      });
    }
    return expense;
  }, [authSession, cashSessions, logActivity]);

  const removeExpense = useCallback((id: string) => {
    const expense = expenses.find((e) => e.id === id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    if (authSession && expense) {
      logActivity(authSession, 'expense_remove', `Gider silindi: ${formatCurrencyTry(expense.amount)}`, {
        aciklama: expense.description,
      });
    }
  }, [expenses, authSession, logActivity]);

  const getTodayDrawerBalance = useCallback(() => {
    const activeDate = getOperationalBusinessDateKey(cashSessions);
    const session = getCashSessionForDate(cashSessions, activeDate);
    const previousSession = getCashSessionForDate(cashSessions, getPreviousBusinessDateKey(activeDate));
    const openingBalance = session?.openingBalance ?? previousSession?.closingBalance ?? 0;
    const daySales = filterByBusinessDate(sales, activeDate);
    const dayReturns = filterByBusinessDate(saleReturns, activeDate);
    const dayExpenses = filterByBusinessDate(expenses, activeDate);
    const dayHandovers = filterByBusinessDate(cashHandovers, activeDate);
    const virman = sumCashVirmanForDate(journalVouchers, activeDate);
    return computeDayCashDrawer(
      openingBalance,
      daySales,
      dayReturns,
      dayExpenses,
      dayHandovers,
      virman.cashToBank,
      virman.bankToCash,
    );
  }, [cashSessions, sales, saleReturns, expenses, cashHandovers, journalVouchers]);

  const addCashHandover = useCallback((amount: number, note?: string, recipient = 'Yönetim') => {
    const value = Math.max(0, amount);
    if (value <= 0) {
      return { ok: false as const, error: 'Geçerli bir tutar girin' };
    }

    const drawerBalance = getTodayDrawerBalance();
    if (value > drawerBalance) {
      return {
        ok: false as const,
        error: `Kasada yeterli nakit yok (mevcut: ${formatCurrency(drawerBalance)})`,
      };
    }

    const handover: CashHandover = {
      id: `H${Date.now()}`,
      amount: value,
      recipient,
      note: note?.trim() || undefined,
      businessDate: getOperationalBusinessDateKey(cashSessions),
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };

    setCashHandovers((prev) => [handover, ...prev]);
    if (authSession) {
      logActivity(authSession, 'cash_handover_add', `Yönetime devir: ${formatCurrencyTry(value)}`, {
        alici: recipient,
      });
    }

    return { ok: true as const, handover };
  }, [authSession, cashSessions, getTodayDrawerBalance, logActivity]);

  const removeCashHandover = useCallback((id: string) => {
    const handover = cashHandovers.find((entry) => entry.id === id);
    setCashHandovers((prev) => prev.filter((entry) => entry.id !== id));
    if (authSession && handover) {
      logActivity(authSession, 'cash_handover_remove', `Yönetime devir silindi: ${formatCurrencyTry(handover.amount)}`, {
        alici: handover.recipient,
      });
    }
  }, [cashHandovers, authSession, logActivity]);

  const addPurchaseInvoice = useCallback((data: {
    invoiceNo: string;
    supplierName: string;
    invoiceDate: string;
    grossAmount: number;
    vatRate: number;
    notes?: string;
  }) => {
    const amounts = splitGrossAmount(data.grossAmount, data.vatRate);
    const invoice: PurchaseInvoice = {
      id: `PI${Date.now()}`,
      invoiceNo: data.invoiceNo,
      supplierName: data.supplierName,
      invoiceDate: data.invoiceDate,
      grossAmount: amounts.grossAmount,
      vatRate: data.vatRate,
      netAmount: amounts.netAmount,
      vatAmount: amounts.vatAmount,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };
    setPurchaseInvoices((prev) => [invoice, ...prev]);
    if (authSession) {
      logActivity(authSession, 'purchase_invoice_add', `Alış faturası eklendi: ${invoice.invoiceNo}`, {
        fatura: invoice.invoiceNo,
        tedarikci: invoice.supplierName,
        tutar: formatCurrencyTry(invoice.grossAmount),
      });
    }
    return invoice;
  }, [authSession, logActivity]);

  const seedDemoVatData = useCallback(() => {
    const demoInvoices = createDemoPurchaseInvoices();
    const demoSales = createDemoSales(products);

    setPurchaseInvoices((prev) => {
      const kept = prev.filter((invoice) => !isDemoPurchaseInvoice(invoice));
      return [...demoInvoices, ...kept];
    });

    setSales((prev) => {
      const kept = prev.filter((sale) => !isDemoSale(sale));
      return [...demoSales, ...kept];
    });

    localStorage.setItem(STORAGE_KEYS.demoVatSeeded, '1');
  }, [products]);

  const seedDemoSupplierData = useCallback((): { ok: true } | { ok: false; reason: 'missing_products' | 'already_seeded' } => {
    if (purchaseInvoices.some((invoice) => isDemoSupplierPurchaseInvoice(invoice))) {
      return { ok: false, reason: 'already_seeded' };
    }

    const demoInvoices = createDemoSupplierPurchaseInvoices(products);
    if (!demoInvoices?.length) {
      return { ok: false, reason: 'missing_products' };
    }

    const demoSupplier = createDemoSupplier();
    const ledgerEntries = createDemoSupplierLedgerEntries(demoInvoices);
    const stockUpdate = applyDemoSupplierStockUpdates(products, demoInvoices, createMovement);

    setSuppliers((prev) => {
      const kept = prev.filter((supplier) => !isDemoSupplier(supplier));
      return [demoSupplier, ...kept];
    });
    setPurchaseInvoices((prev) => [...demoInvoices, ...prev]);
    setSupplierLedger((prev) => [...ledgerEntries, ...prev]);
    setProducts(stockUpdate.products);
    if (stockUpdate.movements.length > 0) {
      setStockMovements((prev) => [...stockUpdate.movements, ...prev]);
    }

    localStorage.setItem(STORAGE_KEYS.demoSupplierSeeded, '1');

    if (authSession) {
      logActivity(authSession, 'purchase_invoice_add', 'Örnek tedarikçi ve 2 alış faturası yüklendi', {
        tedarikci: demoSupplier.name,
        faturaSayisi: String(demoInvoices.length),
      });
    }

    return { ok: true };
  }, [authSession, logActivity, products, purchaseInvoices]);

  useEffect(() => {
    if (!syncReady) return;
    if (localStorage.getItem(STORAGE_KEYS.demoVatSeeded)) return;
    if (purchaseInvoices.length > 0) return;
    seedDemoVatData();
  }, [syncReady, purchaseInvoices.length, seedDemoVatData]);

  useEffect(() => {
    if (!syncReady) return;
    if (localStorage.getItem(STORAGE_KEYS.demoSupplierSeeded)) return;
    if (suppliers.some((supplier) => isDemoSupplier(supplier))) return;
    if (purchaseInvoices.some((invoice) => isDemoSupplierPurchaseInvoice(invoice))) return;
    seedDemoSupplierData();
  }, [syncReady, suppliers, purchaseInvoices, seedDemoSupplierData]);

  useEffect(() => {
    if (!syncReady || irsaliyeStockMigrationRef.current) return;
    if (localStorage.getItem(IRSALIYE_STOCK_MIGRATION_KEY)) {
      irsaliyeStockMigrationRef.current = true;
      return;
    }
    if (products.length === 0) return;

    const { products: nextProducts, movements } = applyIrsaliyeStockToProducts(products);
    irsaliyeStockMigrationRef.current = true;
    localStorage.setItem(IRSALIYE_STOCK_MIGRATION_KEY, '1');

    if (movements.length === 0) return;

    setProducts(nextProducts);
    setStockMovements((prev) => [...movements, ...prev]);
    localStorage.setItem(STORAGE_KEYS.stockInitialized, '1');
    if (authSession) {
      logActivity(
        authSession,
        'stock_adjust',
        `e-İrsaliye stok girişi uygulandı (${movements.length} ürün)`,
        { irsaliye: 'LUY2026000000002' },
      );
    }
  }, [syncReady, products, authSession, logActivity]);

  const refreshExchangeRatesFromTcmb = useCallback(async () => {
    const tcmb = await fetchTcmbRates();
    const nextCurrency = mergeTcmbIntoSettings(settings.currency, tcmb);
    setSettings((prev) => ({ ...prev, currency: nextCurrency }));
    if (authSession) {
      logActivity(authSession, 'settings_update', 'Döviz kurları TCMB\'den güncellendi');
    }
    return nextCurrency;
  }, [authSession, logActivity, settings.currency]);

  const setManualExchangeRate = useCallback((
    currency: ExchangeRateQuote['currency'],
    rateToTry: number,
  ) => {
    const nextCurrency = updateManualRate(settings.currency, currency, rateToTry);
    setSettings((prev) => ({ ...prev, currency: nextCurrency }));
    if (authSession) {
      logActivity(authSession, 'settings_update', `Manuel kur: ${currency} = ${rateToTry}`);
    }
  }, [authSession, logActivity, settings.currency]);

  const updateCurrencySettings = useCallback((patch: Partial<CurrencySettings>) => {
    setSettings((prev) => ({
      ...prev,
      currency: normalizeCurrencySettings({ ...prev.currency, ...patch }),
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', 'Döviz ayarları güncellendi');
    }
  }, [authSession, logActivity]);

  const addCustomExpenseCategory = useCallback((label: string, accountCode = '770'): CustomExpenseCategory | null => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const entry: CustomExpenseCategory = {
      id: createCustomExpenseCategoryId(),
      label: trimmed,
      accountCode: accountCode.trim() || '770',
      createdAt: new Date().toISOString(),
    };
    setSettings((prev) => ({
      ...prev,
      customExpenseCategories: [...normalizeCustomExpenseCategories(prev.customExpenseCategories), entry],
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', `Gider kategorisi eklendi: ${trimmed}`);
    }
    return entry;
  }, [authSession, logActivity]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...patch,
      posNotes: patch.posNotes ? normalizePosNotesConfig(patch.posNotes) : prev.posNotes,
      currency: patch.currency ? normalizeCurrencySettings({ ...prev.currency, ...patch.currency }) : prev.currency,
      dashboardWidgets: patch.dashboardWidgets
        ? normalizeDashboardWidgets({ ...prev.dashboardWidgets, ...patch.dashboardWidgets })
        : prev.dashboardWidgets,
      paymentReminders: patch.paymentReminders
        ? normalizePaymentReminders(patch.paymentReminders)
        : prev.paymentReminders,
      utilityBillSubscriptions: patch.utilityBillSubscriptions
        ? normalizeUtilityBillSubscriptions(patch.utilityBillSubscriptions)
        : prev.utilityBillSubscriptions,
      utilityBillAutoSync: patch.utilityBillAutoSync
        ? { ...prev.utilityBillAutoSync, ...patch.utilityBillAutoSync }
        : prev.utilityBillAutoSync,
      billEmailIngestion: patch.billEmailIngestion
        ? normalizeBillEmailIngestion({ ...prev.billEmailIngestion, ...patch.billEmailIngestion })
        : prev.billEmailIngestion,
      soleProprietorshipTaxCalendar: patch.soleProprietorshipTaxCalendar
        ? normalizeSoleProprietorshipTaxCalendar({
          ...prev.soleProprietorshipTaxCalendar,
          ...patch.soleProprietorshipTaxCalendar,
        })
        : prev.soleProprietorshipTaxCalendar,
      customExpenseCategories: patch.customExpenseCategories
        ? normalizeCustomExpenseCategories(patch.customExpenseCategories)
        : prev.customExpenseCategories,
      crm: patch.crm ? { ...DEFAULT_CRM_SETTINGS, ...prev.crm, ...patch.crm } : prev.crm,
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', 'İşletme ayarları güncellendi', {
        alanlar: Object.keys(patch).join(', '),
      });
    }
  }, [authSession, logActivity]);

  const updateDashboardWidgets = useCallback((patch: Partial<DashboardWidgetsConfig>) => {
    setSettings((prev) => ({
      ...prev,
      dashboardWidgets: normalizeDashboardWidgets({ ...prev.dashboardWidgets, ...patch }),
    }));
  }, []);

  const addPaymentReminder = useCallback((data: {
    title: string;
    amount: number;
    dueDate: string;
    scope: PaymentScope;
    category: PaymentReminderCategory;
    recurrence: PaymentRecurrence;
    notes?: string;
  }) => {
    const now = new Date().toISOString();
    const reminder: PaymentReminder = {
      id: `PR${Date.now()}`,
      title: data.title.trim(),
      amount: Math.max(0, data.amount),
      dueDate: data.dueDate,
      scope: data.scope,
      category: data.category,
      recurrence: data.recurrence,
      status: 'pending',
      notes: data.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    setSettings((prev) => ({
      ...prev,
      paymentReminders: [reminder, ...prev.paymentReminders],
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', `Ödeme hatırlatıcısı eklendi: ${reminder.title}`, {
        vade: reminder.dueDate,
      });
    }
    return reminder;
  }, [authSession, logActivity]);

  const updatePaymentReminder = useCallback((id: string, patch: Partial<PaymentReminder>) => {
    setSettings((prev) => ({
      ...prev,
      paymentReminders: prev.paymentReminders.map((item) => (
        item.id === id
          ? { ...item, ...patch, updatedAt: new Date().toISOString() }
          : item
      )),
    }));
  }, []);

  const removePaymentReminder = useCallback((id: string) => {
    const target = settings.paymentReminders.find((item) => item.id === id);
    setSettings((prev) => ({
      ...prev,
      paymentReminders: prev.paymentReminders.filter((item) => item.id !== id),
    }));
    if (authSession && target) {
      logActivity(authSession, 'settings_update', `Ödeme hatırlatıcısı silindi: ${target.title}`);
    }
  }, [authSession, logActivity, settings.paymentReminders]);

  const markPaymentReminderPaid = useCallback((id: string) => {
    const target = settings.paymentReminders.find((item) => item.id === id);
    if (!target) return;

    const now = new Date().toISOString();
    if (target.recurrence === 'once') {
      updatePaymentReminder(id, { status: 'paid', paidAt: now });
    } else {
      const nextDue = advanceDueDate(target.dueDate, target.recurrence);
      updatePaymentReminder(id, {
        dueDate: nextDue,
        status: 'pending',
        paidAt: now,
      });
    }

    if (authSession) {
      logActivity(authSession, 'settings_update', `Ödeme işlendi: ${target.title}`, {
        tutar: formatCurrencyTry(target.amount),
      });
    }
  }, [authSession, logActivity, settings.paymentReminders, updatePaymentReminder]);

  const markUtilityBillAutoSyncRun = useCallback(() => {
    setSettings((prev) => ({
      ...prev,
      utilityBillAutoSync: {
        ...prev.utilityBillAutoSync,
        lastRunAt: new Date().toISOString(),
      },
    }));
  }, []);

  const updateBillEmailIngestionSettings = useCallback((
    patch: Partial<BillEmailIngestionSettings>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      billEmailIngestion: normalizeBillEmailIngestion({
        ...prev.billEmailIngestion,
        ...patch,
        sources: patch.sources ?? prev.billEmailIngestion.sources,
      }),
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', 'Fatura e-posta ayarları güncellendi');
    }
  }, [authSession, logActivity]);

  const addBillEmailSource = useCallback((partial: Partial<BillEmailSource> & { label: string }) => {
    setSettings((prev) => {
      const nextSource = createBillEmailSource(partial);
      return {
        ...prev,
        billEmailIngestion: normalizeBillEmailIngestion({
          ...prev.billEmailIngestion,
          sources: [...prev.billEmailIngestion.sources, nextSource],
        }),
      };
    });
    if (authSession) {
      logActivity(authSession, 'settings_update', `Fatura e-posta kaynağı eklendi: ${partial.label}`);
    }
  }, [authSession, logActivity]);

  const updateBillEmailSource = useCallback((id: string, patch: Partial<BillEmailSource>) => {
    setSettings((prev) => ({
      ...prev,
      billEmailIngestion: normalizeBillEmailIngestion({
        ...prev.billEmailIngestion,
        sources: prev.billEmailIngestion.sources.map((item) => (
          item.id === id
            ? { ...item, ...patch, updatedAt: new Date().toISOString() }
            : item
        )),
      }),
    }));
  }, []);

  const updateSoleProprietorshipTaxCalendarSettings = useCallback((
    patch: Partial<SoleProprietorshipTaxCalendarSettings>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      soleProprietorshipTaxCalendar: normalizeSoleProprietorshipTaxCalendar({
        ...prev.soleProprietorshipTaxCalendar,
        ...patch,
      }),
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', 'Şahıs firması vergi takvimi ayarları güncellendi');
    }
  }, [authSession, logActivity]);

  const ensureSoleProprietorshipTaxReminders = useCallback(() => {
    const config = settings.soleProprietorshipTaxCalendar;
    if (!config.enabled) {
      return { ok: true, added: 0, message: 'Vergi takvimi kapalı' };
    }

    const activeTemplates = getActiveTaxTemplates({
      includeMuhtasar: config.includeMuhtasar,
      includeBaBs: config.includeBaBs,
      includeSgk: config.includeSgk,
    });
    const activeIds = new Set(activeTemplates.map((item) => `${TAX_AUTO_ID_PREFIX}${item.slug}`));
    const generated = buildSoleProprietorshipTaxReminders({
      includeMuhtasar: config.includeMuhtasar,
      includeBaBs: config.includeBaBs,
      includeSgk: config.includeSgk,
    });

    let added = 0;
    setSettings((prev) => {
      const withoutDisabled = prev.paymentReminders.filter((item) => (
        !isAutoTaxReminder(item) || activeIds.has(item.id)
      ));
      const existingIds = new Set(withoutDisabled.map((item) => item.id));
      const toAdd = generated.filter((item) => !existingIds.has(item.id));
      added = toAdd.length;

      return {
        ...prev,
        paymentReminders: [...toAdd, ...withoutDisabled],
        soleProprietorshipTaxCalendar: {
          ...prev.soleProprietorshipTaxCalendar,
          lastSeededAt: new Date().toISOString(),
        },
      };
    });

    if (authSession && added > 0) {
      logActivity(authSession, 'settings_update', `Şahıs firması vergi takvimi: ${added} hatırlatıcı eklendi`);
    }

    return {
      ok: true,
      added,
      message: added > 0
        ? `${added} vergi hatırlatıcısı takvime eklendi`
        : 'Vergi hatırlatıcıları zaten güncel',
    };
  }, [authSession, logActivity, settings.soleProprietorshipTaxCalendar]);

  const removeBillEmailSource = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      billEmailIngestion: normalizeBillEmailIngestion({
        ...prev.billEmailIngestion,
        sources: prev.billEmailIngestion.sources.filter((item) => item.id !== id),
      }),
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', 'Fatura e-posta kaynağı silindi');
    }
  }, [authSession, logActivity]);

  const repairUtilityBillSubscriptions = useCallback(() => {
    setSettings((prev) => {
      const normalized = normalizeUtilityBillSubscriptions(prev.utilityBillSubscriptions);
      const unchanged = normalized.length === prev.utilityBillSubscriptions.length
        && normalized.every((item, index) => {
          const current = prev.utilityBillSubscriptions[index];
          return current
            && JSON.stringify(current) === JSON.stringify(item);
        });
      if (unchanged) return prev;
      return {
        ...prev,
        utilityBillSubscriptions: normalized,
      };
    });
  }, []);

  const updateUtilityBillSubscription = useCallback((
    id: string,
    patch: Partial<UtilityBillSubscription>,
  ) => {
    setSettings((prev) => ({
      ...prev,
      utilityBillSubscriptions: prev.utilityBillSubscriptions.map((item) => (
        item.id === id
          ? {
            ...item,
            ...patch,
            contractNumber: patch.contractNumber
              ? patch.contractNumber.trim()
              : item.contractNumber,
            updatedAt: new Date().toISOString(),
          }
          : item
      )),
    }));
  }, []);

  const applyUtilityBillSyncResult = useCallback((
    subscription: UtilityBillSubscription,
    result: {
      ok: boolean;
      balance?: number;
      dueDate?: string;
      message?: string;
      diagnosticsText?: string;
    },
  ) => {
    const now = new Date().toISOString();
    const syncPatch: Partial<UtilityBillSubscription> = {
      lastSyncAt: now,
      lastSyncOk: result.ok,
      lastSyncError: result.ok ? undefined : result.message,
      lastSyncDiagnostics: result.ok ? undefined : result.diagnosticsText,
      lastBalance: result.balance,
      lastDueDate: result.dueDate,
    };

    if (!result.ok) {
      updateUtilityBillSubscription(subscription.id, syncPatch);
      return { ok: false, message: result.message || 'ASAT sorgusu başarısız' };
    }

    const amount = Math.max(0, result.balance ?? 0);
    const dueDate = result.dueDate || todayKey();
    const title = `ASAT Su (${ASAT_SCOPE_LABELS[subscription.scope]}) — ${subscription.contractNumber}`;

    let linkedReminderId = subscription.linkedReminderId;
    const existing = linkedReminderId
      ? settings.paymentReminders.find((item) => item.id === linkedReminderId)
      : undefined;

    if (existing) {
      updatePaymentReminder(existing.id, {
        title,
        amount,
        dueDate,
        scope: subscription.scope,
        category: 'water',
        recurrence: 'monthly',
        status: 'pending',
        notes: `ASAT sözleşme: ${subscription.contractNumber} · ${ASAT_SCOPE_LABELS[subscription.scope]}`,
      });
    } else {
      const reminder = addPaymentReminder({
        title,
        amount,
        dueDate,
        scope: subscription.scope,
        category: 'water',
        recurrence: 'monthly',
        notes: `ASAT sözleşme: ${subscription.contractNumber} · ${ASAT_SCOPE_LABELS[subscription.scope]}`,
      });
      linkedReminderId = reminder.id;
    }

    updateUtilityBillSubscription(subscription.id, {
      ...syncPatch,
      linkedReminderId,
    });

    if (authSession) {
      logActivity(authSession, 'settings_update', `ASAT borç güncellendi: ${subscription.contractNumber}`, {
        tutar: formatCurrencyTry(amount),
        vade: dueDate,
      });
    }

    return { ok: true, message: 'ASAT borç bilgisi takvime işlendi' };
  }, [
    addPaymentReminder,
    authSession,
    logActivity,
    settings.paymentReminders,
    updatePaymentReminder,
    updateUtilityBillSubscription,
  ]);

  const syncUtilityBillSubscription = useCallback(async (id: string) => {
    const subscription = settings.utilityBillSubscriptions.find((item) => item.id === id);
    if (!subscription) {
      return { ok: false, message: 'Abonelik bulunamadı' };
    }
    if (!subscription.enabled) {
      return { ok: false, message: 'Abonelik pasif' };
    }

    const result = await fetchAsatDebt(subscription.contractNumber);
    const diagnosticsText = (result as { diagnosticsText?: string }).diagnosticsText;
    return applyUtilityBillSyncResult(subscription, {
      ...result,
      diagnosticsText,
    });
  }, [applyUtilityBillSyncResult, settings.utilityBillSubscriptions]);

  const syncAllUtilityBillSubscriptions = useCallback(async () => {
    const active = settings.utilityBillSubscriptions.filter((item) => item.enabled);
    if (active.length === 0) {
      return { ok: false, message: 'Aktif ASAT aboneliği yok' };
    }

    const results = await Promise.all(active.map((item) => syncUtilityBillSubscription(item.id)));
    const successCount = results.filter((item) => item.ok).length;
    if (successCount === 0) {
      return {
        ok: false,
        message: results.find((item) => item.message)?.message || 'ASAT sorguları başarısız',
      };
    }

    return {
      ok: true,
      message: `${successCount}/${active.length} abonelik güncellendi`,
    };
  }, [settings.utilityBillSubscriptions, syncUtilityBillSubscription]);

  const manualSyncUtilityBillSubscription = useCallback((
    id: string,
    data: { balance: number; dueDate: string; scope?: PaymentScope },
  ) => {
    const subscription = settings.utilityBillSubscriptions.find((item) => item.id === id);
    if (!subscription) {
      return { ok: false, message: 'Abonelik bulunamadı' };
    }

    const scope = data.scope ?? subscription.scope;
    if (scope !== subscription.scope) {
      updateUtilityBillSubscription(id, { scope });
    }

    return applyUtilityBillSyncResult({ ...subscription, scope }, {
      ok: true,
      balance: data.balance,
      dueDate: data.dueDate,
      message: 'Manuel güncelleme',
    });
  }, [applyUtilityBillSyncResult, settings.utilityBillSubscriptions, updateUtilityBillSubscription]);

  const updatePosNotesSettings = useCallback((patch: Partial<AppSettings['posNotes']>) => {
    setSettings((prev) => ({
      ...prev,
      posNotes: normalizePosNotesConfig({ ...prev.posNotes, ...patch }),
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', 'Satış notları ayarları güncellendi');
    }
  }, [authSession, logActivity]);

  const addPosNote = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const note: PosNote = {
      id: `PN${Date.now()}`,
      text: trimmed,
      isActive: true,
    };
    setSettings((prev) => ({
      ...prev,
      posNotes: {
        ...prev.posNotes,
        items: [...prev.posNotes.items, note],
      },
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', 'Satış notu eklendi');
    }
  }, [authSession, logActivity]);

  const updatePosNote = useCallback((noteId: string, patch: Partial<Pick<PosNote, 'text' | 'isActive'>>) => {
    setSettings((prev) => ({
      ...prev,
      posNotes: {
        ...prev.posNotes,
        items: prev.posNotes.items.map((note) =>
          note.id === noteId
            ? { ...note, ...patch, text: patch.text !== undefined ? patch.text.trim() : note.text }
            : note,
        ),
      },
    }));
  }, []);

  const removePosNote = useCallback((noteId: string) => {
    setSettings((prev) => ({
      ...prev,
      posNotes: {
        ...prev.posNotes,
        items: prev.posNotes.items.filter((note) => note.id !== noteId),
      },
    }));
    if (authSession) {
      logActivity(authSession, 'settings_update', 'Satış notu silindi');
    }
  }, [authSession, logActivity]);

  const accountingMethods = createAccountingMethods({
    authSession,
    customers,
    products,
    sales,
    saleReturns,
    expenses,
    purchaseInvoices,
    suppliers,
    customerLedger,
    supplierLedger,
    bankAccounts,
    bankTransactions,
    periodClosures,
    cashCountVariances,
    checkNotes,
    stockAdjustments,
    setSuppliers,
    setCustomerLedger,
    setSupplierLedger,
    setBankAccounts,
    setBankTransactions,
    setPeriodClosures,
    setCashCountVariances,
    setCheckNotes,
    setStockAdjustments,
    journalVouchers,
    equityPartners,
    capitalContributions,
    setJournalVouchers,
    setEquityPartners,
    setCapitalContributions,
    setProducts,
    setStockMovements,
    setPurchaseInvoices,
    setExpenses,
    setSaleReturns,
    setSales,
    createMovement,
    logActivity,
  });

  const removePurchaseInvoice = useCallback((id: string): { ok: boolean; message?: string } => {
    const linkedVoucher = journalVouchers.find(
      (voucher) => voucher.sourceRefId === id
        && voucher.transactionType === 'purchase_invoice'
        && voucher.status !== 'voided',
    );
    if (linkedVoucher) {
      return {
        ok: false,
        message: `Bu fatura ${linkedVoucher.voucherNo} muhasebe fişine bağlı. Önce fişi iptal edin.`,
      };
    }
    const reversed = accountingMethods.reversePurchaseInvoice(id, 'Alış faturası silindi');
    if (!reversed) {
      return { ok: false, message: 'Fatura bulunamadı.' };
    }
    return { ok: true };
  }, [journalVouchers, accountingMethods]);

  const exportBackup = useCallback(() => {
    const backup = buildCurrentSnapshot();
    const blob = new Blob([JSON.stringify({ ...backup, exportedAt: backup.updatedAt }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `greenleaf-pos-backup-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    if (authSession) {
      logActivity(authSession, 'backup_export', 'Tam yedek indirildi');
    }
  }, [buildCurrentSnapshot, authSession, logActivity]);

  const importBackup = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as Partial<PersistedStoreSnapshot> & { exportedAt?: string };
    if (!parsed.products || !Array.isArray(parsed.products)) {
      throw new Error('Geçersiz yedek dosyası');
    }

    const snapshot: PersistedStoreSnapshot = {
      updatedAt: parsed.updatedAt || parsed.exportedAt || new Date().toISOString(),
      products: parsed.products,
      productSets: parsed.productSets ?? loadProductSets(),
      sales: parsed.sales ?? [],
      saleReturns: parsed.saleReturns ?? loadSaleReturns(),
      stockMovements: parsed.stockMovements ?? [],
      customers: parsed.customers ?? [],
      expenses: parsed.expenses ?? [],
      cashHandovers: parsed.cashHandovers ?? loadCashHandovers(),
      cashSessions: parsed.cashSessions ?? loadCashSessions(),
      purchaseInvoices: parsed.purchaseInvoices ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      priceType: parsed.priceType ?? loadPriceType(),
      users: parsed.users?.length
        ? parsed.users.map((user) => normalizeUser(user as unknown as Record<string, unknown>))
        : loadUsers(),
      loginAuditLog: parsed.loginAuditLog ?? loadLoginAuditLog(),
      activityAuditLog: parsed.activityAuditLog ?? loadActivityAuditLog(),
      ...mergeAccountingFromPersisted(parsed),
      crm: normalizeCrmData(parsed.crm),
    };

    applySnapshot(snapshot);
    const saved = await saveStoreSnapshot(snapshot);
    setSyncStatus(saved ? 'synced' : 'local-only');
    if (authSession) {
      logActivity(authSession, 'backup_import', `Yedek içe aktarıldı: ${file.name}`, { dosya: file.name });
    }
    return saved;
  }, [applySnapshot, authSession, logActivity]);

  const resetSalesAndIrsaliyeWarehouse = useCallback(async (): Promise<{ ok: boolean; totalStock: number }> => {
    const catalogProducts = mergeWithSeed(null);
    const snapshot = resetStoreToIrsaliyeWarehouse(buildCurrentSnapshot(), catalogProducts);
    applySnapshot(snapshot);
    saveHeldPosSales([]);
    const saved = await saveStoreSnapshot(snapshot);
    setSyncStatus(saved ? 'synced' : 'local-only');
    const totalStock = snapshot.products.reduce((sum, p) => sum + p.stock, 0);
    if (authSession) {
      logActivity(authSession, 'warehouse_reset', `Satışlar silindi; irsaliye depo (${totalStock} adet)`);
    }
    return { ok: Boolean(saved), totalStock };
  }, [applySnapshot, buildCurrentSnapshot, authSession, logActivity]);

  const pushStoreToServer = useCallback(async () => {
    const snapshot = buildCurrentSnapshot();
    const saved = await saveStoreSnapshot(snapshot);
    setSyncStatus(saved ? 'synced' : 'local-only');
    if (authSession) {
      logActivity(authSession, 'backup_push', 'Veriler sunucuya yüklendi');
    }
    return saved;
  }, [buildCurrentSnapshot, authSession, logActivity]);

  const persistStoreNow = useCallback(async (
    overrides?: { users?: PosUser[]; cashSessions?: DailyCashSession[] },
  ): Promise<boolean> => {
    const snapshot = buildCurrentSnapshot(overrides);
    const saved = await saveStoreSnapshot(snapshot);
    setSyncStatus(saved ? 'synced' : 'local-only');
    return saved;
  }, [buildCurrentSnapshot]);

  const closeCashDay = useCallback((): {
    ok: boolean;
    closingBalance: number;
    error?: string;
  } => {
    const reconciled = reconcileCashSessions(cashSessions, sales, saleReturns, expenses, cashHandovers, journalVouchers);
    const activeDate = getOperationalBusinessDateKey(reconciled);
    const activeSession = reconciled.find((session) => session.date === activeDate);

    if (activeSession?.closedAt) {
      return {
        ok: false,
        closingBalance: activeSession.closingBalance ?? getTodayDrawerBalance(),
        error: 'Aktif kasa günü zaten kapatıldı ve ertesi güne devredildi.',
      };
    }

    const closingBalance = getTodayDrawerBalance();
    let nextSessions = reconciled.map((session) => (
      session.date === activeDate
        ? {
            ...session,
            closingBalance,
            closedAt: new Date().toISOString(),
            closedBy: authSession?.displayName,
            autoClosed: false,
          }
        : session
    ));

    const nextDate = getNextBusinessDateKey(activeDate);
    const nextSessionIndex = nextSessions.findIndex((session) => session.date === nextDate);
    if (nextSessionIndex >= 0) {
      nextSessions = nextSessions.map((session, index) => (
        index === nextSessionIndex
          ? { ...session, openingBalance: closingBalance }
          : session
      ));
    } else {
      nextSessions = [
        ...nextSessions,
        {
          date: nextDate,
          openingBalance: closingBalance,
          createdAt: new Date().toISOString(),
        },
      ].sort((a, b) => a.date.localeCompare(b.date));
    }

    setCashSessions(nextSessions);
    localStorage.setItem(STORAGE_KEYS.cashSessions, JSON.stringify(nextSessions));

    if (authSession) {
      logActivity(authSession, 'cash_day_close', `Gün kapatıldı — ertesi gün açılış: ${formatCurrencyTry(closingBalance)}`, {
        kapanis: closingBalance,
      });
    }

    if (syncReady) {
      void persistStoreNow({ cashSessions: nextSessions });
    }

    return { ok: true, closingBalance };
  }, [authSession, cashHandovers, cashSessions, expenses, getTodayDrawerBalance, journalVouchers, logActivity, persistStoreNow, sales, saleReturns, syncReady]);

  const validateUserForm = useCallback((
    data: {
      displayName: string;
      username: string;
      password?: string;
      role: UserRole;
      allowedTabs: AppPage[];
    },
    editingId?: string,
  ): string | null => {
    if (!data.displayName.trim()) return 'Ad soyad zorunludur.';
    const username = data.username.trim().toLowerCase();
    if (username.length < 3) return 'Kullanıcı adı en az 3 karakter olmalıdır.';
    if (!/^[a-z0-9._-]+$/.test(username)) {
      return 'Kullanıcı adı yalnızca küçük harf, rakam ve . _ - içerebilir.';
    }
    if (users.some((user) => user.username === username && user.id !== editingId)) {
      return 'Bu kullanıcı adı zaten kullanılıyor.';
    }
    if (!editingId && (!data.password || data.password.length < 4)) {
      return 'Şifre en az 4 karakter olmalıdır.';
    }
    if (data.password && data.password.length < 4) {
      return 'Şifre en az 4 karakter olmalıdır.';
    }
    if (data.role === 'cashier' && data.allowedTabs.length === 0) {
      return 'Kasiyer için en az bir sekme seçmelisiniz.';
    }
    return null;
  }, [users]);

  const appendLoginAudit = useCallback(async (
    entry: Omit<LoginAuditEntry, 'id' | 'createdAt' | 'deviceInfo' | 'clientIp'> & {
      deviceInfo?: string;
      clientIp?: string;
    },
  ) => {
    const clientIp = entry.clientIp ?? await getClientIp();
    const record: LoginAuditEntry = {
      id: `LA${Date.now()}`,
      createdAt: new Date().toISOString(),
      deviceInfo: entry.deviceInfo ?? getDeviceInfo(),
      clientIp,
      ...entry,
    };
    setLoginAuditLog((prev) => [record, ...prev].slice(0, MAX_LOGIN_AUDIT_ENTRIES));
  }, []);

  const finalizeLogin = useCallback(async (user: PosUser, method: LoginMethod) => {
    clearLoginLockout(user.username);
    const sessionId = `S${Date.now()}`;
    const session = buildAuthSession(user, sessionId);
    lastTrackedPageRef.current = null;
    saveAuthSession(session);
    setAuthSession(session);
    saveLastQuickUser(user.username);
    await appendLoginAudit({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      success: true,
      method,
      sessionId,
    });
    logActivity(
      session,
      'login',
      `${method === 'pin' ? 'PIN' : 'Şifre'} ile oturum başlatıldı`,
      { method },
    );
  }, [appendLoginAudit, logActivity]);

  const refreshTenantData = useCallback(async (): Promise<void> => {
    const remote = await fetchStoreSnapshot();
    if (remote) {
      applySnapshot(remote);
      setSyncStatus('synced');
    }
  }, [applySnapshot]);

  const logout = useCallback((reason: 'manual' | 'idle' = 'manual') => {
    if (authSession) {
      logActivity(
        authSession,
        'logout',
        reason === 'idle' ? 'Hareketsizlik nedeniyle oturum kapatıldı' : 'Oturum kapatıldı',
        { reason },
      );
    }
    lastTrackedPageRef.current = null;
    clearAuthSession();
    setAuthSession(null);
    setCart([]);
    clearSaleCustomer();
  }, [authSession, logActivity, clearSaleCustomer]);

  const login = useCallback(async (username: string, password: string, totpCode?: string): Promise<LoginResult> => {
    try {
      const normalized = username.trim().toLowerCase();
      const lockCheck = checkLoginAllowed(normalized);
      if (!lockCheck.allowed) {
        return {
          status: 'locked',
          message: lockCheck.message ?? 'Giriş geçici olarak kilitli.',
          retryAfterMs: lockCheck.retryAfterMs,
        };
      }

      const user = users.find((item) => item.username === normalized);
      if (user && !user.isActive) {
        await appendLoginAudit({
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          success: false,
          method: 'password',
          failureReason: 'Hesap kilitli (yönetici)',
        });
        return {
          status: 'locked',
          message: 'Hesabınız yönetici tarafından kilitlendi. Giriş yapamazsınız.',
        };
      }

      if (!user || !verifyPassword(password, user.passwordHash)) {
        recordFailedLogin(normalized);
        await appendLoginAudit({
          username: normalized,
          success: false,
          method: 'password',
          failureReason: 'Kullanıcı adı veya şifre hatalı',
        });
        return { status: 'error', message: 'Kullanıcı adı veya şifre hatalı.' };
      }

      if (user.role === 'admin' && user.totpEnabled && user.totpSecret) {
        if (!totpCode) {
          return { status: 'totp_required', userId: user.id, username: user.username };
        }
        if (!verifyTotpCode(user.totpSecret, totpCode)) {
          recordFailedLogin(normalized);
          await appendLoginAudit({
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            success: false,
            method: 'password',
            failureReason: '2FA kodu hatalı',
          });
          return { status: 'error', message: 'Doğrulama kodu hatalı.' };
        }
      }

      await finalizeLogin(user, 'password');
      return { status: 'success' };
    } catch {
      return { status: 'error', message: 'Giriş sırasında bir hata oluştu. Sayfayı yenileyip tekrar deneyin.' };
    }
  }, [users, appendLoginAudit, finalizeLogin]);

  const loginWithPin = useCallback(async (username: string, pin: string): Promise<LoginResult> => {
    try {
      const normalized = username.trim().toLowerCase();
      if (!isValidPin(pin)) {
        return { status: 'error', message: 'PIN 6 haneli olmalıdır.' };
      }

      const lockCheck = checkLoginAllowed(normalized);
      if (!lockCheck.allowed) {
        return {
          status: 'locked',
          message: lockCheck.message ?? 'Giriş geçici olarak kilitli.',
          retryAfterMs: lockCheck.retryAfterMs,
        };
      }

      const user = users.find((item) => item.username === normalized);
      if (user && !user.isActive) {
        await appendLoginAudit({
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          success: false,
          method: 'pin',
          failureReason: 'Hesap kilitli (yönetici)',
        });
        return {
          status: 'locked',
          message: 'Hesabınız yönetici tarafından kilitlendi. Giriş yapamazsınız.',
        };
      }

      if (!user || !user.pinHash || !verifyPin(pin, user.pinHash)) {
        recordFailedLogin(normalized);
        await appendLoginAudit({
          username: normalized,
          success: false,
          method: 'pin',
          failureReason: 'PIN hatalı',
        });
        return { status: 'error', message: 'Kullanıcı adı veya PIN hatalı.' };
      }

      await finalizeLogin(user, 'pin');
      return { status: 'success' };
    } catch {
      return { status: 'error', message: 'PIN girişi sırasında bir hata oluştu.' };
    }
  }, [users, appendLoginAudit, finalizeLogin]);

  const changePassword = useCallback(async (newPassword: string): Promise<string | null> => {
    if (!authSession) return 'Oturum bulunamadı.';
    if (newPassword.length < 6) return 'Yeni şifre en az 6 karakter olmalıdır.';

    const user = users.find((item) => item.id === authSession.userId);
    if (!user) return 'Kullanıcı bulunamadı.';

    const passwordHash = hashPassword(newPassword);
    const updated: PosUser = {
      ...user,
      passwordHash,
      mustChangePassword: false,
      updatedAt: new Date().toISOString(),
    };

    setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
    const session = buildAuthSession(updated, authSession.sessionId);
    saveAuthSession(session);
    setAuthSession(session);
    logActivity(session, 'password_change', 'Şifre değiştirildi');
    return null;
  }, [authSession, users, logActivity]);

  const verifyAdminCredentials = useCallback(async (
    adminUsername: string,
    adminPassword: string,
    totpCode?: string,
  ): Promise<string | null> => {
    const normalized = adminUsername.trim().toLowerCase();
    const admin = users.find((item) => item.username === normalized && item.isActive && item.role === 'admin');
    if (!admin) return 'Yönetici bulunamadı.';
    if (!verifyPassword(adminPassword, admin.passwordHash)) return 'Yönetici şifresi hatalı.';
    if (admin.totpEnabled && admin.totpSecret) {
      if (!totpCode) return '2FA doğrulama kodu gerekli.';
      if (!verifyTotpCode(admin.totpSecret, totpCode)) return '2FA doğrulama kodu hatalı.';
    }
    return null;
  }, [users]);

  const unlockUserLogin = useCallback((username: string) => {
    adminUnlockLogin(username);
    if (authSession) {
      logActivity(authSession, 'unlock_login', `@${username} giriş kilidi açıldı`, { kullanici: username });
    }
  }, [authSession, logActivity]);

  const getLoginLockouts = useCallback((): LoginLockoutRecord[] => {
    return getAllLoginLockouts().filter((item) => item.requiresAdminUnlock || (item.lockedUntil && new Date(item.lockedUntil) > new Date()));
  }, []);

  const beginTotpSetup = useCallback((): { secret: string; uri: string } | null => {
    if (!authSession || authSession.role !== 'admin') return null;
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, authSession.username);
    return { secret, uri };
  }, [authSession]);

  const enableTotp = useCallback(async (secret: string, code: string): Promise<string | null> => {
    if (!authSession || authSession.role !== 'admin') return 'Yalnızca yönetici 2FA kurabilir.';
    if (!verifyTotpCode(secret, code)) return 'Doğrulama kodu hatalı. Google Authenticator kodunu kontrol edin.';

    const user = users.find((item) => item.id === authSession.userId);
    if (!user) return 'Kullanıcı bulunamadı.';

    const updated: PosUser = {
      ...user,
      totpSecret: secret,
      totpEnabled: true,
      updatedAt: new Date().toISOString(),
    };
    setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
    logActivity(authSession, 'totp_enable', '2FA etkinleştirildi');
    return null;
  }, [authSession, users, logActivity]);

  const disableTotp = useCallback(async (code: string): Promise<string | null> => {
    if (!authSession || authSession.role !== 'admin') return 'Yalnızca yönetici 2FA kapatabilir.';
    const user = users.find((item) => item.id === authSession.userId);
    if (!user?.totpSecret || !user.totpEnabled) return '2FA zaten kapalı.';
    if (!verifyTotpCode(user.totpSecret, code)) return 'Doğrulama kodu hatalı.';

    const updated: PosUser = {
      ...user,
      totpSecret: undefined,
      totpEnabled: false,
      updatedAt: new Date().toISOString(),
    };
    setUsers((prev) => prev.map((item) => (item.id === user.id ? updated : item)));
    logActivity(authSession, 'totp_disable', '2FA devre dışı bırakıldı');
    return null;
  }, [authSession, users, logActivity]);

  const addUser = useCallback(async (data: {
    displayName: string;
    username: string;
    password: string;
    role: UserRole;
    allowedTabs: AppPage[];
    isActive: boolean;
    pin?: string;
  }): Promise<string | null> => {
    const validationError = validateUserForm(data);
    if (validationError) return validationError;
    if (data.pin && !isValidPin(data.pin)) return 'PIN 6 haneli olmalıdır.';

    const now = new Date().toISOString();
    const passwordHash = hashPassword(data.password);
    const user: PosUser = {
      id: `U${Date.now()}`,
      username: data.username.trim().toLowerCase(),
      displayName: data.displayName.trim(),
      passwordHash,
      role: data.role,
      allowedTabs: data.role === 'admin' ? ALL_APP_PAGES : data.allowedTabs,
      isActive: data.isActive,
      mustChangePassword: true,
      pinHash: data.pin ? hashPin(data.pin) : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const nextUsers = [user, ...users];
    setUsers(nextUsers);
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(nextUsers));

    if (authSession) {
      logActivity(authSession, 'user_create', `Kullanıcı oluşturuldu: ${user.displayName}`, {
        kullanici: user.username,
        rol: user.role,
      });
    }

    if (syncReady) {
      const saved = await persistStoreNow({ users: nextUsers });
      if (!saved) {
        return 'Kullanıcı oluşturuldu ancak sunucuya kaydedilemedi. Lütfen tekrar deneyin.';
      }
    }

    return null;
  }, [users, validateUserForm, authSession, logActivity, syncReady, persistStoreNow]);

  const updateUser = useCallback(async (
    id: string,
    data: {
      displayName: string;
      username: string;
      password?: string;
      role: UserRole;
      allowedTabs: AppPage[];
      isActive: boolean;
      pin?: string;
      clearPin?: boolean;
    },
  ): Promise<string | null> => {
    const existing = users.find((user) => user.id === id);
    if (!existing) return 'Kullanıcı bulunamadı.';

    const validationError = validateUserForm(data, id);
    if (validationError) return validationError;
    if (data.pin && !isValidPin(data.pin)) return 'PIN 6 haneli olmalıdır.';

    if (existing.role === 'admin' && data.role !== 'admin') {
      const otherActiveAdmins = users.filter(
        (user) => user.role === 'admin' && user.isActive && user.id !== id,
      );
      if (otherActiveAdmins.length === 0) {
        return 'Sistemde en az bir aktif yönetici olmalıdır.';
      }
    }

    if (!data.isActive && existing.role === 'admin') {
      const otherActiveAdmins = users.filter(
        (user) => user.role === 'admin' && user.isActive && user.id !== id,
      );
      if (otherActiveAdmins.length === 0) {
        return 'Son aktif yönetici pasif yapılamaz.';
      }
    }

    if (!data.isActive && existing.isPrimaryAdmin) {
      return 'Ana yönetici pasif yapılamaz.';
    }

    const passwordHash = data.password ? hashPassword(data.password) : existing.passwordHash;
    let pinHash = existing.pinHash;
    if (data.clearPin) {
      pinHash = undefined;
    } else if (data.pin) {
      pinHash = hashPin(data.pin);
    }
    const updated: PosUser = {
      ...existing,
      username: data.username.trim().toLowerCase(),
      displayName: data.displayName.trim(),
      passwordHash,
      pinHash,
      role: data.role,
      allowedTabs: data.role === 'admin' ? ALL_APP_PAGES : data.allowedTabs,
      isActive: data.isActive,
      updatedAt: new Date().toISOString(),
    };

    const nextUsers = users.map((user) => (user.id === id ? updated : user));
    setUsers(nextUsers);
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(nextUsers));

    if (authSession?.userId === id) {
      if (!updated.isActive) {
        logout();
      } else {
        const session = buildAuthSession(updated, authSession.sessionId);
        saveAuthSession(session);
        setAuthSession(session);
      }
    }

    if (authSession) {
      logActivity(authSession, 'user_update', `Kullanıcı güncellendi: ${updated.displayName}`, {
        kullanici: updated.username,
      });
    }

    if (syncReady) {
      const saved = await persistStoreNow({ users: nextUsers });
      if (!saved) {
        return 'Kullanıcı güncellendi ancak sunucuya kaydedilemedi. Lütfen tekrar deneyin.';
      }
    }

    return null;
  }, [users, validateUserForm, authSession, logout, logActivity, syncReady, persistStoreNow]);

  const removeUser = useCallback((id: string): string | null => {
    const user = users.find((item) => item.id === id);
    if (!user) return 'Kullanıcı bulunamadı.';
    if (authSession?.userId === id) return 'Oturum açık kullanıcı silinemez.';
    if (user.isPrimaryAdmin) return 'Ana yönetici silinemez.';
    if (user.role === 'admin') {
      const otherActiveAdmins = users.filter(
        (item) => item.role === 'admin' && item.isActive && item.id !== id,
      );
      if (otherActiveAdmins.length === 0) {
        return 'Son yönetici silinemez.';
      }
    }
    const nextUsers = users.filter((item) => item.id !== id);
    setUsers(nextUsers);
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(nextUsers));

    if (authSession) {
      logActivity(authSession, 'user_delete', `Kullanıcı silindi: ${user.displayName}`, {
        kullanici: user.username,
      });
    }

    if (syncReady) {
      void persistStoreNow({ users: nextUsers });
    }

    return null;
  }, [users, authSession, logActivity, syncReady, persistStoreNow]);

  const lockUserAccess = useCallback((userId: string): string | null => {
    if (!authSession) return 'Oturum bulunamadı.';
    const actor = users.find((user) => user.id === authSession.userId);
    if (!actor?.isPrimaryAdmin) return 'Bu işlem yalnızca ana yönetici tarafından yapılabilir.';

    const target = users.find((user) => user.id === userId);
    if (!target) return 'Kullanıcı bulunamadı.';
    if (target.isPrimaryAdmin) return 'Ana yönetici kilitlenemez.';
    if (!target.isActive) return null;

    const updated: PosUser = {
      ...target,
      isActive: false,
      updatedAt: new Date().toISOString(),
    };
    setUsers((prev) => prev.map((user) => (user.id === userId ? updated : user)));

    if (authSession) {
      logActivity(authSession, 'user_lock', `Giriş izni kilitlendi: ${target.displayName}`, {
        kullanici: target.username,
      });
    }
    return null;
  }, [authSession, users, logActivity]);

  const unlockUserAccess = useCallback((userId: string): string | null => {
    if (!authSession) return 'Oturum bulunamadı.';
    const actor = users.find((user) => user.id === authSession.userId);
    if (!actor?.isPrimaryAdmin) return 'Bu işlem yalnızca ana yönetici tarafından yapılabilir.';

    const target = users.find((user) => user.id === userId);
    if (!target) return 'Kullanıcı bulunamadı.';
    if (target.isActive) return null;

    const updated: PosUser = {
      ...target,
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    setUsers((prev) => prev.map((user) => (user.id === userId ? updated : user)));

    if (authSession) {
      logActivity(authSession, 'user_unlock', `Giriş izni açıldı: ${target.displayName}`, {
        kullanici: target.username,
      });
    }
    return null;
  }, [authSession, users, logActivity]);

  const updateProductWholesalePrices = useCallback((productId: number, prices: WholesalePrices) => {
    setProducts((prev) =>
      prev.map((product) => (product.id === productId ? { ...product, wholesalePrices: prices } : product)),
    );
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== productId || item.priceType !== 'wholesale') return item;
        const product = products.find((p) => p.id === productId);
        if (!product) return item;
        return {
          ...item,
          unitPrice: getCartUnitPrice(product, item.quantity, 'wholesale'),
        };
      }),
    );
  }, [products]);

  const applyBulkWholesalePrices = useCallback((
    base: WholesalePriceBase,
    discounts: WholesaleTierDiscounts,
    productIds?: number[],
  ) => {
    const targetIds = productIds ? new Set(productIds) : null;
    setProducts((prev) => {
      const updated = prev.map((product) => {
        if (targetIds && !targetIds.has(product.id)) return product;
        const basePrice = getProductWholesaleBasePrice(product, base);
        return {
          ...product,
          wholesalePrices: buildWholesalePricesFromBase(basePrice, discounts),
        };
      });
      setCart((cartPrev) =>
        cartPrev.map((item) => {
          if (item.priceType !== 'wholesale') return item;
          if (item.productId == null) return item;
          if (targetIds && !targetIds.has(item.productId)) return item;
          const product = updated.find((p) => p.id === item.productId);
          if (!product) return item;
          return {
            ...item,
            unitPrice: getCartUnitPrice(product, item.quantity, 'wholesale'),
          };
        }),
      );
      return updated;
    });
    if (authSession) {
      logActivity(authSession, 'settings_update', 'Toplu toptan fiyatlar güncellendi', {
        taban: base,
        urun: targetIds ? targetIds.size : products.length,
      });
    }
  }, [authSession, logActivity, products.length]);

  const updateProductImage = useCallback((productId: number, imageUrl: string) => {
    const product = products.find((p) => p.id === productId);
    try {
      saveProductImage(productId, imageUrl);
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, imageUrl } : p)),
      );
      if (authSession && product) {
        logActivity(authSession, 'product_image_update', `Ürün görseli güncellendi: ${product.name}`, {
          urun: product.name,
        });
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Resim kaydedilemedi');
    }
  }, [products, authSession, logActivity]);

  const removeProductImage = useCallback((productId: number) => {
    const product = products.find((p) => p.id === productId);
    removeStoredImage(productId);
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const { imageUrl: _, ...rest } = p;
        return rest as Product;
      }),
    );
    if (authSession && product) {
      logActivity(authSession, 'product_image_remove', `Ürün görseli kaldırıldı: ${product.name}`, {
        urun: product.name,
      });
    }
  }, [products, authSession, logActivity]);

  const resolveCheckoutCustomer = useCallback((): Customer | undefined => {
    if (saleCustomerId) {
      return customers.find((c) => c.id === saleCustomerId);
    }
    const normalizedGl = normalizeGreenleafNumber(saleGreenleafNumber);
    if (normalizedGl) {
      return customers.find((c) => normalizeGreenleafNumber(c.greenleafNumber ?? '') === normalizedGl);
    }
    const trimmedName = saleCustomerName.trim();
    if (trimmedName) {
      return customers.find((c) => c.name.toLowerCase() === trimmedName.toLowerCase());
    }
    return undefined;
  }, [customers, saleCustomerId, saleGreenleafNumber, saleCustomerName]);

  const getCheckoutPreview = useCallback((paymentMethod: Sale['paymentMethod']) => {
    const paidItems = cart.filter((item) => item.priceType !== 'sample');
    const subtotal = paidItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const customer = resolveCheckoutCustomer();
    return buildCheckoutPreview(
      subtotal,
      cart,
      products,
      customer,
      customers,
      sales,
      saleReturns,
      customerLedger,
      crmData,
      crmSettings,
      saleCouponCode,
      saleLoyaltyPointsToRedeem,
      paymentMethod,
    );
  }, [
    cart,
    products,
    customers,
    sales,
    saleReturns,
    customerLedger,
    crmData,
    crmSettings,
    saleCouponCode,
    saleLoyaltyPointsToRedeem,
    resolveCheckoutCustomer,
  ]);

  const completeSale = useCallback(
    (paymentMethod: Sale['paymentMethod'], options?: CompleteSaleOptions) => {
      if (cart.length === 0) return null;
      setCheckoutError(null);

      const posCheckout = { ...DEFAULT_POS_CHECKOUT_SETTINGS, ...settings.posCheckout };
      const activeDate = getOperationalBusinessDateKey(cashSessions);
      const daySession = cashSessions.find((session) => session.date === activeDate);
      if (posCheckout.blockSalesWhenDayClosed && daySession?.closedAt) {
        setCheckoutError('Kasa günü kapalı — yeni satış yapılamaz.');
        return null;
      }

      const paidItems = cart.filter((item) => item.priceType !== 'sample');
      const sampleItems = cart.filter((item) => item.priceType === 'sample');
      const subtotal = paidItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const saleKind: Sale['saleKind'] =
        paidItems.length > 0 && sampleItems.length > 0
          ? 'mixed'
          : sampleItems.length > 0
            ? 'sample'
            : 'sale';
      const normalizedGl = normalizeGreenleafNumber(saleGreenleafNumber);
      const trimmedName = saleCustomerName.trim();

      let resolvedCustomerId = saleCustomerId;
      let resolvedCustomerName = trimmedName;

      if (saleCustomerId) {
        const selected = customers.find((c) => c.id === saleCustomerId);
        if (selected) {
          resolvedCustomerId = selected.id;
          resolvedCustomerName = trimmedName || selected.name;
        }
      }

      if (normalizedGl && !resolvedCustomerId) {
        const existingByGl = customers.find(
          (c) => normalizeGreenleafNumber(c.greenleafNumber ?? '') === normalizedGl,
        );
        if (existingByGl) {
          resolvedCustomerId = existingByGl.id;
          resolvedCustomerName = trimmedName || existingByGl.name;
        }
      }

      if (!resolvedCustomerId && trimmedName) {
        if (normalizedGl) {
          const existingByGl = customers.find(
            (c) => normalizeGreenleafNumber(c.greenleafNumber ?? '') === normalizedGl,
          );
          if (existingByGl) {
            resolvedCustomerId = existingByGl.id;
            resolvedCustomerName = trimmedName || existingByGl.name;
          } else {
            const quickCustomer = addQuickCustomer(
              trimmedName,
              normalizedGl,
              authSession?.displayName,
            );
            if (quickCustomer) {
              resolvedCustomerId = quickCustomer.id;
              resolvedCustomerName = quickCustomer.name;
            }
          }
        } else {
          const matchedByName = customers.find(
            (c) => c.name.toLowerCase() === trimmedName.toLowerCase(),
          );
          if (matchedByName) {
            resolvedCustomerId = matchedByName.id;
            resolvedCustomerName = matchedByName.name;
          }
        }
      }

      if (!resolvedCustomerId) {
        resolvedCustomerId = resolveSaleCustomerId(
          {
            customerId: saleCustomerId,
            greenleafNumber: normalizedGl,
            customerName: resolvedCustomerName,
            paymentMethod,
          },
          customers,
        );
        if (resolvedCustomerId && !resolvedCustomerName) {
          const owner = customers.find((c) => c.id === resolvedCustomerId);
          resolvedCustomerName = owner?.name ?? '';
        }
      }

      const draftAttributed = isSaleCustomerAttributed(
        {
          customerId: resolvedCustomerId,
          customerName: resolvedCustomerName,
          paymentMethod,
          greenleafNumber: normalizedGl,
        },
        customers,
      );
      if (resolvedCustomerId && !draftAttributed) {
        resolvedCustomerId = undefined;
        resolvedCustomerName = '';
      }

      if (paymentMethod === 'credit' && !resolvedCustomerId) {
        setCheckoutError('Veresiye için müşteri gerekli.');
        return null;
      }

      const resolvedCustomer = resolvedCustomerId
        ? customers.find((c) => c.id === resolvedCustomerId)
        : undefined;

      const previewPaymentMethod = paymentMethod === 'split' ? 'cash' : paymentMethod;
      const finalPreview = buildCheckoutPreview(
        subtotal,
        cart,
        products,
        resolvedCustomer,
        customers,
        sales,
        saleReturns,
        customerLedger,
        crmData,
        crmSettings,
        saleCouponCode,
        saleLoyaltyPointsToRedeem,
        previewPaymentMethod,
      );

      if (finalPreview.blockedReason) {
        setCheckoutError(finalPreview.blockedReason);
        return null;
      }
      if (finalPreview.creditError) {
        setCheckoutError(finalPreview.creditError);
        return null;
      }
      if (finalPreview.couponError && saleCouponCode.trim()) {
        setCheckoutError(finalPreview.couponError);
        return null;
      }

      const total = finalPreview.total;
      const crmDiscountTotal = finalPreview.campaignDiscount
        + finalPreview.couponDiscount
        + finalPreview.loyaltyDiscount;

      if (paymentMethod === 'split') {
        const splitErr = validatePaymentSplits(total, options?.paymentSplits ?? []);
        if (splitErr) {
          setCheckoutError(splitErr);
          return null;
        }
      }
      if (paymentMethod === 'cash' && options?.cashTendered != null && options.cashTendered < total) {
        setCheckoutError('Alınan nakit tutarı yetersiz.');
        return null;
      }

      let dueDate: string | undefined;
      if (paymentMethod === 'credit') {
        const dueDays = resolvedCustomer
          ? (getCustomerCrmProfile(resolvedCustomer, crmSettings).defaultDueDays ?? crmSettings.defaultDueDays)
          : crmSettings.defaultDueDays;
        dueDate = computeDueDateKey(dueDays);
      }

      const sale: Sale = {
        id: `S${Date.now()}`,
        items: [...cart],
        total,
        saleKind,
        paymentMethod,
        paymentSplits: paymentMethod === 'split' ? options?.paymentSplits : undefined,
        cashTendered: paymentMethod === 'cash' ? options?.cashTendered : undefined,
        changeGiven: paymentMethod === 'cash' && options?.cashTendered != null
          ? computeChange(total, options.cashTendered)
          : undefined,
        dueDate,
        customerId: resolvedCustomerId || undefined,
        customerName: resolvedCustomerId ? (resolvedCustomerName || undefined) : undefined,
        greenleafNumber: normalizedGl,
        cashierId: authSession?.userId,
        cashierName: authSession?.displayName,
        businessDate: getOperationalBusinessDateKey(cashSessions),
        createdAt: new Date().toISOString(),
        crmDiscountTotal: crmDiscountTotal > 0 ? crmDiscountTotal : undefined,
        couponCode: saleCouponCode.trim() ? saleCouponCode.trim().toUpperCase() : undefined,
        loyaltyPointsEarned: finalPreview.pointsToEarn > 0 ? finalPreview.pointsToEarn : undefined,
        loyaltyPointsRedeemed: finalPreview.pointsRedeemed > 0 ? finalPreview.pointsRedeemed : undefined,
        campaignId: finalPreview.campaignId,
      };

      const saleMovements: StockMovement[] = [];
      const paidProductItems = paidItems.filter((item) => item.productId != null);
      const paidSetItems = paidItems.filter((item) => item.setId != null);

      setProducts((prev) =>
        prev.map((p) => {
          const sampleItem = sampleItems.find((c) => c.productId === p.id);
          const paidItem = paidProductItems.find((c) => c.productId === p.id);
          if (!sampleItem && !paidItem) return p;

          let next = p;
          if (sampleItem) {
            const prevSample = p.sampleStock ?? 0;
            const newSample = Math.max(0, prevSample - sampleItem.quantity);
            saleMovements.push(
              createMovement(p, 'sample', sampleItem.quantity, prevSample, newSample, 'Numune çıkışı'),
            );
            next = { ...next, sampleStock: newSample };
          }
          if (paidItem) {
            const newStock = Math.max(0, p.stock - paidItem.quantity);
            saleMovements.push(
              createMovement(p, 'sale', paidItem.quantity, p.stock, newStock, 'Satış'),
            );
            next = { ...next, stock: newStock };
          }
          return next;
        }),
      );

      if (paidSetItems.length > 0) {
        setProductSets((prev) =>
          prev.map((set) => {
            const paidItem = paidSetItems.find((c) => c.setId === set.id);
            if (!paidItem) return set;
            const newStock = Math.max(0, set.stock - paidItem.quantity);
            saleMovements.push(
              createSetMovement(set, 'set_sale', paidItem.quantity, set.stock, newStock, 'Set satışı'),
            );
            return { ...set, stock: newStock, updatedAt: new Date().toISOString() };
          }),
        );
      }

      if (saleMovements.length > 0) {
        setStockMovements((prev) => [...saleMovements, ...prev]);
      }

      setSales((prev) => [sale, ...prev]);

      if (finalPreview.couponId) {
        setCrmData((prev) => ({
          ...prev,
          coupons: prev.coupons.map((c) => (
            c.id === finalPreview.couponId
              ? { ...c, usedCount: c.usedCount + 1 }
              : c
          )),
        }));
      }

      if (resolvedCustomer && (finalPreview.pointsToEarn > 0 || finalPreview.pointsRedeemed > 0)) {
        const crm = getCustomerCrmProfile(resolvedCustomer, crmSettings);
        const nextPoints = Math.max(
          0,
          crm.loyaltyPoints - finalPreview.pointsRedeemed + finalPreview.pointsToEarn,
        );
        setCustomers((prev) => prev.map((c) => (
          c.id === resolvedCustomer.id
            ? withUpdatedCrm(c, { loyaltyPoints: nextPoints }, crmSettings)
            : c
        )));
      }

      if (resolvedCustomerId && total > 0) {
        const ledgerEntries = buildSaleLedgerEntries(
          { ...sale, total },
          resolvedCustomerId,
          authSession?.displayName,
        ).map((entry, index) => ({
          ...entry,
          id: `${entry.id}-${Date.now()}-${index}`,
        }));
        if (ledgerEntries.length > 0) {
          setCustomerLedger((prev) => [...ledgerEntries, ...prev]);
        }
      }

      if (authSession) {
        const paymentLabel = saleKind === 'sample'
          ? 'Numune'
          : paymentMethod === 'cash' ? 'Nakit'
            : paymentMethod === 'card' ? 'Kart'
              : paymentMethod === 'credit' ? 'Veresiye'
                : paymentMethod === 'split' ? 'Bölünmüş'
                  : 'Havale';
        const sampleQty = sampleItems.reduce((sum, item) => sum + item.quantity, 0);
        const summary = saleKind === 'sample'
          ? `Numune verildi — ${sampleQty} adet`
          : saleKind === 'mixed'
            ? `Satış tamamlandı — ${formatCurrency(total)} + ${sampleQty} numune`
            : `Satış tamamlandı — ${formatCurrency(total)}`;
        logActivity(authSession, 'sale_complete', summary, {
          odeme: paymentLabel,
          urun: cart.length,
          satisId: sale.id,
          tip: saleKind,
        });
      }
      setCart([]);
      setSaleGreenleafNumber('');
      setSaleCustomerId(undefined);
      setSaleCustomerName('');
      setSaleCouponCode('');
      setSaleLoyaltyPointsToRedeem(0);
      return sale;
    },
    [
      cart,
      saleCustomerId,
      saleCustomerName,
      saleGreenleafNumber,
      saleCouponCode,
      saleLoyaltyPointsToRedeem,
      customers,
      sales,
      saleReturns,
      customerLedger,
      crmData,
      crmSettings,
      products,
      authSession,
      addQuickCustomer,
      logActivity,
      productSets,
      cashSessions,
      settings.posCheckout,
    ],
  );

  const parkCurrentSale = useCallback((label?: string): HeldPosSale | null => {
    if (cart.length === 0) return null;
    const held: HeldPosSale = {
      id: `HOLD-${Date.now()}`,
      label: label?.trim() || `Beklet ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
      cart: [...cart],
      saleCustomerId,
      saleCustomerName,
      saleGreenleafNumber,
      saleCouponCode,
      saleLoyaltyPointsToRedeem,
      saleMode,
      heldAt: new Date().toISOString(),
    };
    setHeldPosSales((prev) => [held, ...prev].slice(0, 20));
    setCart([]);
    setSaleCouponCode('');
    setSaleLoyaltyPointsToRedeem(0);
    return held;
  }, [cart, saleCustomerId, saleCustomerName, saleGreenleafNumber, saleCouponCode, saleLoyaltyPointsToRedeem, saleMode]);

  const recallHeldSale = useCallback((id: string): boolean => {
    const held = heldPosSales.find((entry) => entry.id === id);
    if (!held) return false;
    setCart(held.cart);
    setSaleCustomerId(held.saleCustomerId);
    setSaleCustomerName(held.saleCustomerName);
    setSaleGreenleafNumber(held.saleGreenleafNumber);
    setSaleCouponCode(held.saleCouponCode);
    setSaleLoyaltyPointsToRedeem(held.saleLoyaltyPointsToRedeem);
    setSaleMode(held.saleMode);
    setHeldPosSales((prev) => prev.filter((entry) => entry.id !== id));
    return true;
  }, [heldPosSales]);

  const discardHeldSale = useCallback((id: string) => {
    setHeldPosSales((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const recordCashDrawerCount = useCallback((countedAmount: number, note?: string) => {
    const activeDate = getOperationalBusinessDateKey(cashSessions);
    const expected = getTodayDrawerBalance();
    const cashCount = {
      countedAt: new Date().toISOString(),
      countedAmount,
      expectedAmount: expected,
      countedBy: authSession?.displayName,
      note,
    };
    setCashSessions((prev) => prev.map((session) => (
      session.date === activeDate ? { ...session, cashCount } : session
    )));
    return { expected, difference: countedAmount - expected, cashCount };
  }, [authSession?.displayName, cashSessions, getTodayDrawerBalance]);

  const updatePosCheckoutSettings = useCallback((patch: Partial<typeof DEFAULT_POS_CHECKOUT_SETTINGS>) => {
    updateSettings({
      posCheckout: { ...DEFAULT_POS_CHECKOUT_SETTINGS, ...settings.posCheckout, ...patch },
    });
  }, [settings.posCheckout, updateSettings]);

  const processSaleReturn = useCallback((
    saleId: string,
    requestedLines: Array<{ lineKey: string; quantity: number }>,
    refundMethod: Sale['paymentMethod'],
    reason?: string,
    note?: string,
  ): { ok: boolean; message?: string; returnRecord?: SaleReturn } => {
    const sale = sales.find((entry) => entry.id === saleId);
    if (!sale) return { ok: false, message: 'Satış fişi bulunamadı' };

    if (authSession?.role === 'cashier' && !isSaleReturnableByCashier(sale.createdAt)) {
      return { ok: false, message: CASHIER_RETURN_EXPIRED_MESSAGE };
    }

    const built = buildReturnLines(sale, saleReturns, requestedLines);
    if (!built.ok) return { ok: false, message: built.message };

    const normalizedRefund = refundMethod === 'split' ? 'cash' : refundMethod;

    const returnRecord: SaleReturn = {
      id: `R${Date.now()}`,
      originalSaleId: sale.id,
      items: built.lines,
      refundTotal: built.refundTotal,
      refundMethod: normalizedRefund,
      reason: reason?.trim() || undefined,
      note: note?.trim() || undefined,
      cashierId: authSession?.userId,
      cashierName: authSession?.displayName,
      businessDate: getOperationalBusinessDateKey(cashSessions),
      createdAt: new Date().toISOString(),
    };

    const movementNote = `İade — ${sale.id}${reason ? ` · ${reason}` : ''}`;
    const returnMovements: StockMovement[] = [];

    setProducts((prev) =>
      prev.map((product) => {
        const sampleLine = built.lines.find((line) => line.productId === product.id && line.priceType === 'sample');
        const paidLine = built.lines.find((line) => line.productId === product.id && line.priceType !== 'sample');
        if (!sampleLine && !paidLine) return product;

        let next = product;
        if (sampleLine) {
          const prevSample = product.sampleStock ?? 0;
          const newSample = prevSample + sampleLine.quantity;
          returnMovements.push(
            createMovement(
              product,
              'return',
              sampleLine.quantity,
              prevSample,
              newSample,
              `${movementNote} (numune)`,
              { saleId: sale.id, returnId: returnRecord.id },
            ),
          );
          next = { ...next, sampleStock: newSample };
        }
        if (paidLine) {
          const newStock = product.stock + paidLine.quantity;
          returnMovements.push(
            createMovement(
              product,
              'return',
              paidLine.quantity,
              product.stock,
              newStock,
              movementNote,
              { saleId: sale.id, returnId: returnRecord.id },
            ),
          );
          next = { ...next, stock: newStock };
        }
        return next;
      }),
    );

    const setLines = built.lines.filter((line) => line.setId);
    if (setLines.length > 0) {
      setProductSets((prev) =>
        prev.map((set) => {
          const returnLine = setLines.find((line) => line.setId === set.id);
          if (!returnLine) return set;
          const newStock = set.stock + returnLine.quantity;
          returnMovements.push(
            createSetMovement(
              set,
              'set_return',
              returnLine.quantity,
              set.stock,
              newStock,
              movementNote,
              { saleId: sale.id, returnId: returnRecord.id },
            ),
          );
          return { ...set, stock: newStock, updatedAt: new Date().toISOString() };
        }),
      );
    }

    if (returnMovements.length > 0) {
      setStockMovements((prev) => [...returnMovements, ...prev]);
    }

    const nextReturns = [returnRecord, ...saleReturns];
    const nextStatus = getSaleStatus(sale, nextReturns);
    setSales((prev) =>
      prev.map((entry) => (entry.id === sale.id ? { ...entry, status: nextStatus } : entry)),
    );
    setSaleReturns(nextReturns);

    if (sale.customerId && built.refundTotal > 0) {
      setCustomerLedger((prev) => [{
        id: `CL${Date.now()}`,
        customerId: sale.customerId!,
        type: 'return',
        amount: -built.refundTotal,
        saleId: sale.id,
        note: `Satış iadesi — ${returnRecord.id}`,
        createdAt: new Date().toISOString(),
        createdBy: authSession?.displayName,
      }, ...prev]);
    }

    if (authSession) {
      const paymentLabel = refundMethod === 'cash' ? 'Nakit' : refundMethod === 'card' ? 'Kart' : 'Havale';
      logActivity(authSession, 'sale_return', `İade işlendi — ${formatCurrencyTry(built.refundTotal)}`, {
        odeme: paymentLabel,
        satisId: sale.id,
        iadeId: returnRecord.id,
        kasiyer: authSession.displayName,
      });
    }

    return { ok: true, returnRecord };
  }, [sales, saleReturns, authSession, cashSessions, logActivity]);

  const updateCustomerCrm = useCallback((customerId: string, patch: Partial<CustomerCrmProfile>) => {
    setCustomers((prev) => prev.map((c) => (
      c.id === customerId ? withUpdatedCrm(c, patch, crmSettings) : c
    )));
    if (authSession) {
      logActivity(authSession, 'customer_update', 'Müşteri CRM profili güncellendi', { musteriId: customerId });
    }
  }, [authSession, crmSettings, logActivity]);

  const addCrmTag = useCallback((label: string, color = '#51b848') => {
    const entry = { id: `TAG-${Date.now()}`, label: label.trim(), color };
    if (!entry.label) return null;
    setCrmData((prev) => ({ ...prev, tagDefinitions: [...prev.tagDefinitions, entry] }));
    return entry;
  }, []);

  const addCrmLead = useCallback((data: Omit<import('../types/crm').CrmLead, 'id' | 'createdAt' | 'updatedAt' | 'stage'> & { stage?: import('../types/crm').CrmLeadStage }) => {
    const now = new Date().toISOString();
    const lead = {
      id: `LEAD-${Date.now()}`,
      stage: data.stage ?? 'new',
      name: data.name.trim(),
      phone: data.phone,
      email: data.email,
      source: data.source,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    };
    setCrmData((prev) => ({ ...prev, leads: [lead, ...prev.leads] }));
    return lead;
  }, []);

  const convertCrmLead = useCallback((leadId: string, customerPayload: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    const customer = addCustomer(customerPayload);
    setCrmData((prev) => ({
      ...prev,
      leads: prev.leads.map((l) => (
        l.id === leadId
          ? { ...l, stage: 'converted' as const, convertedCustomerId: customer.id, updatedAt: new Date().toISOString() }
          : l
      )),
    }));
    return customer;
  }, [addCustomer]);

  const addCrmTask = useCallback((task: Omit<import('../types/crm').CrmTask, 'id' | 'createdAt' | 'status'> & { status?: import('../types/crm').CrmTaskStatus }) => {
    const entry = {
      id: `TASK-${Date.now()}`,
      status: task.status ?? 'open',
      customerId: task.customerId,
      leadId: task.leadId,
      title: task.title.trim(),
      dueDate: task.dueDate,
      assignedTo: task.assignedTo,
      createdAt: new Date().toISOString(),
    };
    if (!entry.title) return null;
    setCrmData((prev) => ({ ...prev, tasks: [entry, ...prev.tasks] }));
    return entry;
  }, []);

  const completeCrmTask = useCallback((taskId: string) => {
    setCrmData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((t) => (
        t.id === taskId ? { ...t, status: 'done', completedAt: new Date().toISOString() } : t
      )),
    }));
  }, []);

  const addCrmManualActivity = useCallback((customerId: string, title: string, detail?: string, kind: import('../types/crm').CrmActivityKind = 'note') => {
    const entry = {
      id: `ACT-${Date.now()}`,
      customerId,
      kind,
      title,
      detail,
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };
    setCrmData((prev) => ({ ...prev, manualActivities: [entry, ...prev.manualActivities] }));
    return entry;
  }, [authSession]);

  const addCrmCommunication = useCallback((
    customerId: string,
    channel: import('../types/crm').CrmCommunicationChannel,
    summary: string,
  ) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    const crm = getCustomerCrmProfile(customer, crmSettings);
    const entry = {
      id: `CM-${Date.now()}`,
      channel,
      summary,
      createdAt: new Date().toISOString(),
      createdBy: authSession?.displayName,
    };
    updateCustomerCrm(customerId, {
      communicationLog: [entry, ...crm.communicationLog],
    });
  }, [authSession, customers, crmSettings, updateCustomerCrm]);

  const mergeCrmCustomers = useCallback((primaryId: string, secondaryId: string): string | null => {
    const result = mergeCustomersData(
      primaryId,
      secondaryId,
      customers,
      sales,
      customerLedger,
      crmData,
      crmSettings,
    );
    if ('error' in result) return result.error;
    setCustomers(result.customers);
    setSales(result.sales);
    setCustomerLedger(result.ledger);
    setCrmData(result.crmData);
    if (authSession) {
      logActivity(authSession, 'customer_update', 'Müşteri kayıtları birleştirildi', { birincil: primaryId });
    }
    return null;
  }, [authSession, crmData, crmSettings, customerLedger, customers, logActivity, sales]);

  const importCustomersFromCsv = useCallback((text: string): { imported: number; errors: string[] } => {
    const { rows, errors } = parseCustomerCsv(text);
    if (rows.length === 0) return { imported: 0, errors };
    const importedCustomers = rowsToCustomers(rows, crmSettings);
    setCustomers((prev) => [...importedCustomers, ...prev]);
    if (authSession) {
      logActivity(authSession, 'customer_add', `CSV ile ${importedCustomers.length} müşteri içe aktarıldı`);
    }
    return { imported: importedCustomers.length, errors };
  }, [authSession, crmSettings, logActivity]);

  const updateCrmData = useCallback((patch: Partial<CrmPersistedData>) => {
    setCrmData((prev) => normalizeCrmData({ ...prev, ...patch }));
  }, []);

  const saveCrmSmsTemplate = useCallback((id: string | null, name: string, body: string) => {
    const trimmedName = name.trim();
    const trimmedBody = body.trim();
    if (!trimmedName || !trimmedBody) return null;
    const now = new Date().toISOString();
    if (id) {
      setCrmData((prev) => ({
        ...prev,
        smsTemplates: prev.smsTemplates.map((t) => (
          t.id === id ? { ...t, name: trimmedName, body: trimmedBody } : t
        )),
      }));
      return id;
    }
    const newId = `SMS-${Date.now()}`;
    setCrmData((prev) => ({
      ...prev,
      smsTemplates: [...prev.smsTemplates, { id: newId, name: trimmedName, body: trimmedBody, createdAt: now }],
    }));
    return newId;
  }, []);

  const removeCrmSmsTemplate = useCallback((id: string) => {
    setCrmData((prev) => ({
      ...prev,
      smsTemplates: prev.smsTemplates.filter((t) => t.id !== id),
    }));
  }, []);

  const saveCrmEmailTemplate = useCallback((id: string | null, name: string, subject: string, body: string) => {
    const trimmedName = name.trim();
    const trimmedSubject = subject.trim();
    const trimmedBody = body.trim();
    if (!trimmedName || !trimmedSubject || !trimmedBody) return null;
    if (id) {
      setCrmData((prev) => ({
        ...prev,
        emailTemplates: prev.emailTemplates.map((t) => (
          t.id === id ? { ...t, name: trimmedName, subject: trimmedSubject, body: trimmedBody } : t
        )),
      }));
      return id;
    }
    const newId = `EMAIL-${Date.now()}`;
    setCrmData((prev) => ({
      ...prev,
      emailTemplates: [...prev.emailTemplates, {
        id: newId,
        name: trimmedName,
        subject: trimmedSubject,
        body: trimmedBody,
        createdAt: new Date().toISOString(),
      }],
    }));
    return newId;
  }, []);

  const saveCrmSegment = useCallback((segment: CrmSavedSegment) => {
    setCrmData((prev) => ({
      ...prev,
      segments: prev.segments.map((s) => (s.id === segment.id ? segment : s)),
    }));
  }, []);

  const saveCrmAutomationFlow = useCallback((id: string, patch: Partial<CrmAutomationFlow>) => {
    setCrmData((prev) => ({
      ...prev,
      automationFlows: prev.automationFlows.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }, []);

  const removeCrmAutomationFlow = useCallback((id: string) => {
    setCrmData((prev) => ({
      ...prev,
      automationFlows: prev.automationFlows.filter((f) => f.id !== id),
    }));
  }, []);

  const runCrmDailyAutomation = useCallback((): number => {
    const result = runDailyAutomation(
      customers,
      sales,
      saleReturns,
      customerLedger,
      crmData,
      crmSettings,
      settings.businessName,
    );
    if (result.enqueued > 0 || result.settings.automationLastRunDate !== crmSettings.automationLastRunDate) {
      setCrmData(result.crmData);
      updateSettings({ crm: result.settings });
    }
    return result.enqueued;
  }, [customers, sales, saleReturns, customerLedger, crmData, crmSettings, settings.businessName, updateSettings]);

  const processCrmOutreachQueue = useCallback(async () => {
    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const nextQueue = [...crmData.outreachQueue];

    for (const item of nextQueue) {
      if (item.status !== 'pending') continue;
      const customer = customers.find((c) => c.id === item.customerId);
      if (!customer) {
        item.status = 'failed';
        item.error = 'Müşteri bulunamadı';
        failed += 1;
        continue;
      }

      if (item.channel === 'email') {
        if (!customer.email) {
          item.status = 'skipped';
          item.error = 'E-posta yok';
          skipped += 1;
          continue;
        }
        const res = await sendCrmEmailApi({
          to: customer.email,
          subject: item.subject ?? 'Bildirim',
          body: item.body,
          fromName: crmSettings.emailFromName,
        });
        if (res.ok) {
          item.status = 'sent';
          item.sentAt = new Date().toISOString();
          sent += 1;
          addCrmCommunication(customer.id, 'email', `Otomatik e-posta: ${item.subject ?? ''}`);
        } else {
          item.status = 'failed';
          item.error = res.error ?? 'Gönderim hatası';
          failed += 1;
        }
        continue;
      }

      if (item.channel === 'sms') {
        if (!customer.phone) {
          item.status = 'skipped';
          item.error = 'Telefon yok';
          skipped += 1;
          continue;
        }
        item.status = 'skipped';
        item.error = 'SMS operatör API yapılandırılmadı — müşteri kartından manuel gönderin';
        skipped += 1;
      }
    }

    setCrmData((prev) => ({ ...prev, outreachQueue: nextQueue }));
    return { sent, failed, skipped };
  }, [crmData.outreachQueue, customers, crmSettings.emailFromName, addCrmCommunication]);

  const addCrmCustomerDocument = useCallback(async (customerId: string, label: string, file: File) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    const docId = `DOC-${Date.now()}`;
    const storageKey = crmAttachmentKey(customerId, docId);
    const dataUrl = await readFileAsDataUrl(file);
    saveCrmAttachment(storageKey, dataUrl);
    const crm = getCustomerCrmProfile(customer, crmSettings);
    const doc = {
      id: docId,
      label,
      storageKey,
      mimeType: file.type,
      fileName: file.name,
      sizeBytes: file.size,
      createdAt: new Date().toISOString(),
    };
    updateCustomerCrm(customerId, { documents: [...crm.documents, doc] });
  }, [customers, crmSettings, updateCustomerCrm]);

  const removeCrmCustomerDocument = useCallback((customerId: string, documentId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    const crm = getCustomerCrmProfile(customer, crmSettings);
    const target = crm.documents.find((d) => d.id === documentId);
    if (target?.storageKey) removeCrmAttachment(target.storageKey);
    updateCustomerCrm(customerId, {
      documents: crm.documents.filter((d) => d.id !== documentId),
    });
  }, [customers, crmSettings, updateCustomerCrm]);

  const updateCrmSettings = useCallback((patch: Partial<CrmSettings>) => {
    updateSettings({ crm: { ...crmSettings, ...patch } });
  }, [crmSettings, updateSettings]);

  const anonymizeCustomer = useCallback((customerId: string) => {
    setCustomers((prev) => prev.map((c) => {
      if (c.id !== customerId) return c;
      return {
        ...c,
        name: 'Anonim Müşteri',
        taxNumber: '00000000000',
        phone: undefined,
        email: undefined,
        address: '',
        notes: undefined,
        crm: {
          ...getCustomerCrmProfile(c, crmSettings),
          anonymizedAt: new Date().toISOString(),
          status: 'archived',
          marketingConsent: { email: false, sms: false },
        },
        updatedAt: new Date().toISOString(),
      };
    }));
    if (authSession) {
      logActivity(authSession, 'customer_update', 'Müşteri anonimleştirildi', { musteriId: customerId });
    }
  }, [authSession, crmSettings, logActivity]);

  const cartSubtotal = cart.reduce(
    (sum, item) => (item.priceType === 'sample' ? sum : sum + item.unitPrice * item.quantity),
    0,
  );
  const cartCheckoutPreview = getCheckoutPreview('cash');
  const cartTotal = cart.length > 0 ? cartCheckoutPreview.total : cartSubtotal;
  const cartSampleCount = cart.reduce(
    (sum, item) => (item.priceType === 'sample' ? sum + item.quantity : sum),
    0,
  );
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const activeBusinessDate = getOperationalBusinessDateKey(cashSessions);
  const activeCashSession = getCashSessionForDate(cashSessions, activeBusinessDate);
  const previousCashSession = getCashSessionForDate(
    cashSessions,
    getPreviousBusinessDateKey(activeBusinessDate),
  );

  const todaySales = filterByBusinessDate(sales, activeBusinessDate);
  const todayReturns = filterByBusinessDate(saleReturns, activeBusinessDate);
  const todayGrossTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
  const todayRefundTotal = todayReturns.reduce((sum, entry) => sum + entry.refundTotal, 0);
  const todayTotal = todayGrossTotal - todayRefundTotal;

  const totalStockUnits = products.reduce((sum, p) => sum + p.stock, 0);
  const lowStockThreshold = settings.lowStockThreshold;
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= lowStockThreshold).length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;

  const todayExpenses = filterByBusinessDate(expenses, activeBusinessDate);
  const todayExpenseTotal = todayExpenses.reduce((sum, e) => sum + e.amount, 0);
  const todayHandovers = filterByBusinessDate(cashHandovers, activeBusinessDate);
  const todayHandoverTotal = todayHandovers.reduce((sum, entry) => sum + entry.amount, 0);
  const todayCashSession = activeCashSession;
  const todayOpeningBalance = activeCashSession?.openingBalance ?? previousCashSession?.closingBalance ?? 0;
  const isCashDayClosed = Boolean(activeCashSession?.closedAt);

  const weekSales = sales.filter((s) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(s.createdAt) >= weekAgo;
  });
  const weekReturns = saleReturns.filter((entry) => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return new Date(entry.createdAt) >= weekAgo;
  });
  const weekGrossTotal = weekSales.reduce((sum, s) => sum + s.total, 0);
  const weekRefundTotal = weekReturns.reduce((sum, entry) => sum + entry.refundTotal, 0);
  const weekTotal = weekGrossTotal - weekRefundTotal;

  return {
    products,
    productSets,
    cart,
    priceType,
    setPriceType,
    salePriceType,
    saleMode,
    setSaleMode: changeSaleMode,
    setProductSampleStock,
    setProductSampleFlag,
    saleGreenleafNumber,
    saleCustomerId,
    saleCustomerName,
    updateSaleGreenleafNumber,
    updateSaleCustomerName,
    selectSaleCustomer,
    clearSaleCustomer,
    sales,
    saleReturns,
    stockMovements,
    customers,
    expenses,
    cashHandovers,
    cashSessions,
    purchaseInvoices,
    suppliers,
    customerLedger,
    supplierLedger,
    bankAccounts,
    bankTransactions,
    periodClosures,
    cashCountVariances,
    checkNotes,
    stockAdjustments,
    journalVouchers,
    equityPartners,
    capitalContributions,
    settings,
    users,
    loginAuditLog,
    activityAuditLog,
    authSession,
    costProfitRevealed,
    toggleCostProfitReveal,
    login,
    loginWithPin,
    refreshTenantData,
    changePassword,
    verifyAdminCredentials,
    unlockUserLogin,
    getLoginLockouts,
    getActivitiesForLogin,
    trackPageView,
    beginTotpSetup,
    enableTotp,
    disableTotp,
    logout,
    addUser,
    updateUser,
    removeUser,
    lockUserAccess,
    unlockUserAccess,
    addToCart,
    addSetToCart,
    scanAddToCart,
    addSampleToCart,
    updateCartQuantity,
    updateSetCartQuantity,
    removeFromCart,
    removeSetFromCart,
    saveProductSet,
    removeProductSet,
    assembleProductSet,
    adjustProductSetStock,
    clearCart,
    updateProductImage,
    removeProductImage,
    completeSale,
    parkCurrentSale,
    recallHeldSale,
    discardHeldSale,
    heldPosSales,
    recordCashDrawerCount,
    updatePosCheckoutSettings,
    processSaleReturn,
    setProductStock,
    updateProductBarcode,
    adjustProductStock,
    setBulkStock,
    getUnitPrice,
    updateProductWholesalePrices,
    applyBulkWholesalePrices,
    addCustomer,
    addQuickCustomer,
    updateCustomer,
    removeCustomer,
    addExpense,
    removeExpense,
    addCashHandover,
    removeCashHandover,
    closeCashDay,
    addPurchaseInvoice,
    removePurchaseInvoice,
    ...accountingMethods,
    seedDemoVatData,
    seedDemoSupplierData,
    addCustomExpenseCategory,
    updateSettings,
    updateCurrencySettings,
    updateDashboardWidgets,
    addPaymentReminder,
    updatePaymentReminder,
    removePaymentReminder,
    markPaymentReminderPaid,
    repairUtilityBillSubscriptions,
    markUtilityBillAutoSyncRun,
    updateBillEmailIngestionSettings,
    addBillEmailSource,
    updateBillEmailSource,
    removeBillEmailSource,
    updateSoleProprietorshipTaxCalendarSettings,
    ensureSoleProprietorshipTaxReminders,
    updateUtilityBillSubscription,
    syncUtilityBillSubscription,
    syncAllUtilityBillSubscriptions,
    manualSyncUtilityBillSubscription,
    refreshExchangeRatesFromTcmb,
    setManualExchangeRate,
    updatePosNotesSettings,
    addPosNote,
    updatePosNote,
    removePosNote,
    exportBackup,
    importBackup,
    resetSalesAndIrsaliyeWarehouse,
    pushStoreToServer,
    persistStoreNow,
    syncStatus,
    cartTotal,
    cartSampleCount,
    cartItemCount,
    todayTotal,
    todayGrossTotal,
    todayRefundTotal,
    todaySales,
    todayReturns,
    weekTotal,
    weekSales,
    weekReturns,
    todayExpenseTotal,
    todayExpenses,
    todayHandovers,
    todayHandoverTotal,
    todayCashSession,
    todayOpeningBalance,
    activeBusinessDate,
    activeCashSession,
    isCashDayClosed,
    totalStockUnits,
    lowStockCount,
    outOfStockCount,
    lowStockThreshold,
    crmData,
    crmSettings,
    saleCouponCode,
    setSaleCouponCode,
    saleLoyaltyPointsToRedeem,
    setSaleLoyaltyPointsToRedeem,
    checkoutError,
    setCheckoutError,
    cartSubtotal,
    cartCheckoutPreview,
    getCheckoutPreview,
    updateCustomerCrm,
    addCrmTag,
    addCrmLead,
    convertCrmLead,
    addCrmTask,
    completeCrmTask,
    addCrmManualActivity,
    addCrmCommunication,
    mergeCrmCustomers,
    importCustomersFromCsv,
    updateCrmData,
    updateCrmSettings,
    saveCrmSmsTemplate,
    removeCrmSmsTemplate,
    saveCrmEmailTemplate,
    saveCrmSegment,
    saveCrmAutomationFlow,
    removeCrmAutomationFlow,
    runCrmDailyAutomation,
    processCrmOutreachQueue,
    addCrmCustomerDocument,
    removeCrmCustomerDocument,
    anonymizeCustomer,
  };
}

export type Store = ReturnType<typeof useStore>;
