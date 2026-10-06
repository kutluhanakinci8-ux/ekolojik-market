import type { CartItem } from './product';
import type { Sale } from './product';

export type PosFiscalTiming = 'before_sale' | 'after_sale';
export type PosFiscalFailMode = 'confirm' | 'continue';

export interface PosCheckoutSettings {
  /** Kapalı kasa gününde satış engelle */
  blockSalesWhenDayClosed: boolean;
  /** Fiş önce mi sonra mı */
  fiscalTiming: PosFiscalTiming;
  /** Yazar kasa hatasında confirm vs otomatik devam */
  fiscalFailMode: PosFiscalFailMode;
  /** Ürün grid sayfa boyutu (barkod modunda yüksek tutulabilir) */
  productGridPageSize: number;
  /** Arama varken grid gizle — daha hızlı barkod akışı */
  hideGridWhenSearching: boolean;
}

export const DEFAULT_POS_CHECKOUT_SETTINGS: PosCheckoutSettings = {
  blockSalesWhenDayClosed: true,
  fiscalTiming: 'after_sale',
  fiscalFailMode: 'continue',
  productGridPageSize: 30,
  hideGridWhenSearching: true,
};

export type SplitPaymentMethod = 'cash' | 'card' | 'transfer';

export interface SalePaymentSplit {
  method: SplitPaymentMethod;
  amount: number;
}

export interface CompleteSaleOptions {
  paymentSplits?: SalePaymentSplit[];
  /** Nakit ödeme — müşterinin verdiği tutar */
  cashTendered?: number;
}

export interface HeldPosSale {
  id: string;
  label: string;
  cart: CartItem[];
  saleCustomerId?: string;
  saleCustomerName: string;
  saleGreenleafNumber: string;
  saleCouponCode: string;
  saleLoyaltyPointsToRedeem: number;
  saleMode: 'retail' | 'wholesale';
  heldAt: string;
}

export interface CashDrawerCount {
  countedAt: string;
  countedAmount: number;
  expectedAmount: number;
  countedBy?: string;
  note?: string;
}

export type SaleWithSplits = Sale & {
  paymentMethod: Sale['paymentMethod'] | 'split';
  paymentSplits?: SalePaymentSplit[];
  cashTendered?: number;
  changeGiven?: number;
};
