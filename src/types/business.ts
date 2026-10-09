import type { PaymentStatus, PurchaseInvoiceLine } from './accounting';
import type { CurrencySettings } from './currency';
import type { CashDrawerCount, PosCheckoutSettings } from './pos';
import { DEFAULT_POS_CHECKOUT_SETTINGS } from './pos';
import { DEFAULT_CRM_SETTINGS, type CrmSettings } from './crm';
import { DEFAULT_CURRENCY_SETTINGS } from './currency';
import type { DashboardWidgetsConfig } from './dashboard';
import { DEFAULT_DASHBOARD_WIDGETS } from './dashboard';
import type { PaymentReminder } from './paymentReminder';
import {
  DEFAULT_BILL_EMAIL_INGESTION,
  normalizeBillEmailIngestion,
  type BillEmailIngestionSettings,
} from './billEmailIngestion';
import {
  DEFAULT_SOLE_PROPRIETORSHIP_TAX_CALENDAR,
  normalizeSoleProprietorshipTaxCalendar,
  type SoleProprietorshipTaxCalendarSettings,
} from './soleProprietorshipTaxCalendar';
import {
  DEFAULT_UTILITY_BILL_AUTO_SYNC,
  DEFAULT_UTILITY_BILL_SUBSCRIPTIONS,
  normalizeUtilityBillSubscriptions,
  type UtilityBillAutoSyncSettings,
  type UtilityBillSubscription,
} from './utilityBillSubscription';
import type { PriceType } from './product';
import type { CustomerCrmProfile } from './crm';

export type CustomerType = 'individual' | 'corporate';

/** Bireysel müşteri TC / pasaport formatının bağlı olduğu ülke */
export type IdentityDocumentCountry =
  | 'TR'
  | 'RU'
  | 'KZ'
  | 'UZ'
  | 'TM'
  | 'KG'
  | 'AZ'
  | 'AM'
  | 'TJ'
  | 'GE'
  | 'UA'
  | 'MD'
  | 'BY'
  | 'EE'
  | 'LV'
  | 'LT';

export const IDENTITY_DOCUMENT_COUNTRY_CODES: IdentityDocumentCountry[] = [
  'TR',
  'RU',
  'KZ',
  'UZ',
  'TM',
  'KG',
  'AZ',
  'AM',
  'TJ',
  'GE',
  'UA',
  'MD',
  'BY',
  'EE',
  'LV',
  'LT',
];

export const IDENTITY_DOCUMENT_COUNTRY_OPTIONS: {
  code: IdentityDocumentCountry;
  label: string;
  example: string;
}[] = [
  { code: 'TR', label: 'Türkiye', example: '12345678901 (TC 11 hane)' },
  { code: 'RU', label: 'Rusya', example: '751234567 (9 rakam)' },
  {
    code: 'KZ',
    label: 'Kazakistan',
    example: 'N/D/S+7 rakam, CT+7 (vatansız), 7–9 rakam (kimlik/eski)',
  },
  {
    code: 'UZ',
    label: 'Özbekistan',
    example: 'FA–FD/AA/AB/EX/TT/SE+7 rakam veya kimlik ID+7',
  },
  { code: 'TM', label: 'Türkmenistan', example: 'A/D/S + 7 rakam (8 hane)' },
  {
    code: 'KG',
    label: 'Kırgızistan',
    example: 'Pasaport AC/AN/DA/SA veya A/D/S; kimlik ID veya I +7 rakam',
  },
  { code: 'AZ', label: 'Azerbaycan', example: 'C/P/D/S + 7 rakam (8 hane)' },
  { code: 'AM', label: 'Ermenistan', example: 'AM/AN/AE/AR + 7 rakam' },
  { code: 'TJ', label: 'Tacikistan', example: 'HR/CR veya M + 7 rakam' },
  { code: 'GE', label: 'Gürcistan', example: 'A/B/D + 7 rakam (8 hane)' },
  { code: 'UA', label: 'Ukrayna', example: '731234567 (9 rakam, harf yok)' },
  { code: 'MD', label: 'Moldova', example: 'A/B + 7–8 rakam veya 7–8 rakam' },
  { code: 'BY', label: 'Belarus', example: 'AB/BM/HB/KH/PP + 7 rakam' },
  { code: 'EE', label: 'Estonya', example: 'EE + 7 rakam' },
  { code: 'LV', label: 'Letonya', example: 'LV + 7 rakam veya 7 rakam (eski)' },
  { code: 'LT', label: 'Litvanya', example: '12345678 (8 rakam)' },
];

export interface Customer {
  id: string;
  type: CustomerType;
  /** Ad Soyad (bireysel) veya Firma Unvanı (kurumsal) */
  name: string;
  /** Greenleaf üye / distribütör numarası */
  greenleafNumber?: string;
  /** Sponsor adı */
  sponsorName?: string;
  /** Sponsor Greenleaf numarası */
  sponsorGreenleafNumber?: string;
  /** TC Kimlik No (11) veya Vergi Kimlik No / VKN (10) */
  taxNumber: string;
  /** Bireysel: kimlik/pasaport formatı için ülke kodu (özel formatlı ülkeler) */
  identityDocumentCountry?: IdentityDocumentCountry;
  /** Bireysel: kullanıcının seçtiği / yazdığı kimlik ülkesi adı */
  identityDocumentCountryName?: string;
  /** Kurumsal müşteriler için zorunlu */
  taxOffice?: string;
  address: string;
  city: string;
  district: string;
  postalCode?: string;
  country: string;
  phone?: string;
  email?: string;
  notes?: string;
  /** POS satış ekranından hızlı kayıt */
  registeredFrom?: 'pos' | 'admin';
  /** Kaydı oluşturan kullanıcı adı */
  registeredBy?: string;
  /** CRM profili (sadakat, etiket, limit, izinler) */
  crm?: CustomerCrmProfile;
  createdAt: string;
  updatedAt: string;
}

export type BuiltinExpenseCategory = 'rent' | 'utilities' | 'supplies' | 'salary' | 'other';

export type ExpenseCategory = BuiltinExpenseCategory | (string & {});

export interface CustomExpenseCategory {
  id: string;
  label: string;
  /** Yevmiye gider hesabı (varsayılan 770) */
  accountCode: string;
  createdAt: string;
}

export function isBuiltinExpenseCategory(category: string): category is BuiltinExpenseCategory {
  return category === 'rent'
    || category === 'utilities'
    || category === 'supplies'
    || category === 'salary'
    || category === 'other';
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  /** YYYY-MM-DD — operasyonel iş günü (yoksa createdAt kullanılır) */
  businessDate?: string;
  /** Belge / fiş no */
  documentNo?: string;
  supplierName?: string;
  /** KDV oranı (örn. 20) */
  vatRate?: number;
  /** KDV tutarı */
  vatAmount?: number;
  /** KDV hariç matrah */
  netAmount?: number;
  createdAt: string;
}

/** Kasiyerin yönetime nakit devri */
export interface CashHandover {
  id: string;
  amount: number;
  recipient: string;
  note?: string;
  /** YYYY-MM-DD — operasyonel iş günü (yoksa createdAt kullanılır) */
  businessDate?: string;
  createdAt: string;
  createdBy?: string;
}

/** Günlük kasa oturumu — açılış ve kapanış bakiyesi */
export interface DailyCashSession {
  /** YYYY-MM-DD */
  date: string;
  openingBalance: number;
  closingBalance?: number;
  closedAt?: string;
  closedBy?: string;
  autoClosed?: boolean;
  /** Kasa sayım kaydı */
  cashCount?: CashDrawerCount;
  createdAt: string;
}

/** Mal alış faturası — KDV hesabı için */
export interface PurchaseInvoice {
  id: string;
  invoiceNo: string;
  supplierName: string;
  supplierId?: string;
  /** YYYY-MM-DD */
  invoiceDate: string;
  /** KDV dahil toplam */
  grossAmount: number;
  /** Örn. 20 */
  vatRate: number;
  /** KDV hariç matrah */
  netAmount: number;
  /** KDV tutarı */
  vatAmount: number;
  notes?: string;
  lines?: PurchaseInvoiceLine[];
  paymentStatus?: PaymentStatus;
  paidAmount?: number;
  dueDate?: string;
  /** Stok ve alış fiyatı güncelle */
  affectsStock?: boolean;
  createdAt: string;
}

export interface PosNote {
  id: string;
  text: string;
  isActive: boolean;
}

export interface PosNotesConfig {
  /** Her notun ekranda kalma süresi (saniye) */
  displayDurationSec: number;
  /** Boş sepette saat ile notlar arasında bekleme süresi (dakika) */
  repeatIntervalMin: number;
  items: PosNote[];
}

export type TenantProductProfile = 'full' | 'pos-lite';

export interface AppSettings {
  businessName: string;
  /** `pos-lite`: stok + satış + sınırlı raporlar; Posta/müşteri modülleri kapalı profil */
  productProfile?: TenantProductProfile;
  lowStockThreshold: number;
  defaultPriceType: PriceType;
  posNotes: PosNotesConfig;
  currency: CurrencySettings;
  dashboardWidgets: DashboardWidgetsConfig;
  paymentReminders: PaymentReminder[];
  utilityBillSubscriptions: UtilityBillSubscription[];
  utilityBillAutoSync: UtilityBillAutoSyncSettings;
  billEmailIngestion: BillEmailIngestionSettings;
  soleProprietorshipTaxCalendar: SoleProprietorshipTaxCalendarSettings;
  customExpenseCategories?: CustomExpenseCategory[];
  crm?: CrmSettings;
  posCheckout?: PosCheckoutSettings;
}

export const DEFAULT_POS_NOTES: PosNotesConfig = {
  displayDurationSec: 8,
  repeatIntervalMin: 1,
  items: [],
};

export const DEFAULT_SETTINGS: AppSettings = {
  businessName: 'Greenleaf Market',
  lowStockThreshold: 10,
  defaultPriceType: 'partner',
  posNotes: DEFAULT_POS_NOTES,
  currency: DEFAULT_CURRENCY_SETTINGS,
  dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS,
  paymentReminders: [],
  utilityBillSubscriptions: DEFAULT_UTILITY_BILL_SUBSCRIPTIONS.map((item) => ({ ...item })),
  utilityBillAutoSync: { ...DEFAULT_UTILITY_BILL_AUTO_SYNC },
  billEmailIngestion: normalizeBillEmailIngestion(DEFAULT_BILL_EMAIL_INGESTION),
  soleProprietorshipTaxCalendar: normalizeSoleProprietorshipTaxCalendar(
    DEFAULT_SOLE_PROPRIETORSHIP_TAX_CALENDAR,
  ),
  customExpenseCategories: [],
  crm: { ...DEFAULT_CRM_SETTINGS },
  posCheckout: { ...DEFAULT_POS_CHECKOUT_SETTINGS },
};

export { normalizeUtilityBillSubscriptions };

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: 'Bireysel',
  corporate: 'Kurumsal',
};

export const EXPENSE_CATEGORY_LABELS: Record<BuiltinExpenseCategory, string> = {
  rent: 'Kira',
  utilities: 'Fatura',
  supplies: 'Malzeme',
  salary: 'Personel',
  other: 'Diğer',
};
