/** Desteklenen para birimleri — muhasebe ana para birimi TRY */

export type SupportedCurrency = 'TRY' | 'USD' | 'KZT';

export type ExchangeRateSource = 'tcmb' | 'vakifbank' | 'manual';

/** Hangi kur tipi işlemlerde kullanılır */
export type ExchangeRateSide = 'buy' | 'sell' | 'mid';

export interface ExchangeRateQuote {
  currency: Exclude<SupportedCurrency, 'TRY'>;
  /** 1 birim yabancı para = X TL */
  rateToTry: number;
  buyRate?: number;
  sellRate?: number;
  source: ExchangeRateSource;
  updatedAt: string;
  /** Yönetici manuel müdahale etti mi */
  isManualOverride?: boolean;
}

export interface CurrencyRateHistoryPoint {
  currency: Exclude<SupportedCurrency, 'TRY'>;
  /** 1 birim yabancı para = X TL */
  rateToTry: number;
  recordedAt: string;
}

export interface CurrencySettings {
  /** Muhasebe / raporlama ana para birimi */
  baseCurrency: 'TRY';
  /** İşlemde varsayılan gösterim para birimi */
  displayCurrency: SupportedCurrency;
  /** Otomatik kur kaynağı */
  autoSource: 'tcmb' | 'manual';
  /** İşlemlerde kullanılacak kur (alış/satış/orta) */
  rateSide: ExchangeRateSide;
  rates: Record<Exclude<SupportedCurrency, 'TRY'>, ExchangeRateQuote>;
  /** TCMB çekimi ve manuel kur güncellemelerinden biriken geçmiş */
  rateHistory?: CurrencyRateHistoryPoint[];
  lastAutoFetchAt?: string;
  /** VakıfBank API — apiportal.vakifbank.com.tr kayıt sonrası */
  vakifbank?: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
  };
}

export const CURRENCY_LABELS: Record<SupportedCurrency, string> = {
  TRY: 'Türk Lirası (₺)',
  USD: 'Amerikan Doları ($)',
  KZT: 'Kazak Tengesi (₸)',
};

export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  TRY: '₺',
  USD: '$',
  KZT: '₸',
};

const now = new Date().toISOString();

export const DEFAULT_CURRENCY_SETTINGS: CurrencySettings = {
  baseCurrency: 'TRY',
  displayCurrency: 'TRY',
  autoSource: 'tcmb',
  rateSide: 'sell',
  lastAutoFetchAt: undefined,
  rates: {
    USD: {
      currency: 'USD',
      rateToTry: 34.5,
      buyRate: 34.4,
      sellRate: 34.5,
      source: 'manual',
      updatedAt: now,
    },
    KZT: {
      currency: 'KZT',
      rateToTry: 0.065,
      buyRate: 0.064,
      sellRate: 0.065,
      source: 'manual',
      updatedAt: now,
    },
  },
  vakifbank: { enabled: false },
};
