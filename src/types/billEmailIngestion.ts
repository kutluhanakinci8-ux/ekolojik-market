import type { PaymentReminderCategory, PaymentScope } from './paymentReminder';

/** Kurum / fatura kaynağı türü */
export type BillEmailProvider =
  | 'asat'
  | 'ck_akdeniz'
  | 'igdas'
  | 'turkcell'
  | 'generic'
  | 'custom';

/** Gelen kutusu bağlantı modu */
export type BillEmailInboxMode =
  | 'dedicated_gmail'
  | 'plus_alias'
  | 'custom_imap';

export interface BillEmailSource {
  id: string;
  /** Örn. ASAT Ev, CK Akdeniz İşyeri */
  label: string;
  provider: BillEmailProvider;
  /**
   * Kurum profiline yazılacak adres.
   * Plus alias modunda otomatik üretilir; dedicated modda ana kutu adresi kullanılır.
   */
  forwardingAlias: string;
  /** Plus alias etiketi (örn. asat-ev) */
  aliasTag?: string;
  scope: PaymentScope;
  category: PaymentReminderCategory;
  /** Sözleşme / abone no — eşleştirme için */
  contractNumber?: string;
  /** Gönderen filtresi (örn. @asat.gov.tr) */
  senderFilter?: string;
  enabled: boolean;
  linkedReminderId?: string;
  lastIngestedAt?: string;
  lastIngestedOk?: boolean;
  lastIngestedError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillEmailIngestionSettings {
  enabled: boolean;
  inboxMode: BillEmailInboxMode;
  /** İzlenen ana e-posta (Gmail veya IMAP kullanıcı) */
  inboxAddress: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string;
  /** Dakika — sunucu tarafı otomasyon için */
  pollIntervalMin: number;
  sources: BillEmailSource[];
  lastPollAt?: string;
  lastPollOk?: boolean;
  lastPollError?: string;
  lastPollMessage?: string;
}

export const BILL_EMAIL_PROVIDER_LABELS: Record<BillEmailProvider, string> = {
  asat: 'ASAT',
  ck_akdeniz: 'CK Akdeniz',
  igdas: 'İGDAŞ',
  turkcell: 'Turkcell',
  generic: 'Genel Fatura',
  custom: 'Özel',
};

export const BILL_EMAIL_INBOX_MODE_LABELS: Record<BillEmailInboxMode, string> = {
  dedicated_gmail: 'Özel Gmail hesabı',
  plus_alias: 'Gmail + alias (mevcut adres)',
  custom_imap: 'Özel IMAP sunucusu',
};

export const BILL_EMAIL_PROVIDER_SENDER_HINTS: Partial<Record<BillEmailProvider, string>> = {
  asat: '@asat.gov.tr',
  ck_akdeniz: '@ckakdeniz.com.tr',
};

const NOW = '2026-01-01T00:00:00.000Z';

export const DEFAULT_BILL_EMAIL_INGESTION: BillEmailIngestionSettings = {
  enabled: false,
  inboxMode: 'plus_alias',
  inboxAddress: '',
  imapHost: 'imap.gmail.com',
  imapPort: 993,
  imapUser: '',
  imapPassword: '',
  pollIntervalMin: 30,
  sources: [
    {
      id: 'bill-email-asat-ev',
      label: 'ASAT Ev',
      provider: 'asat',
      forwardingAlias: '',
      aliasTag: 'asat-ev',
      scope: 'personal',
      category: 'water',
      contractNumber: '385092',
      senderFilter: '@asat.gov.tr',
      enabled: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
    {
      id: 'bill-email-asat-isyeri',
      label: 'ASAT İşyeri',
      provider: 'asat',
      forwardingAlias: '',
      aliasTag: 'asat-isyeri',
      scope: 'company',
      category: 'water',
      contractNumber: '1002109637',
      senderFilter: '@asat.gov.tr',
      enabled: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
};

function normalizeProvider(value: unknown): BillEmailProvider {
  const providers: BillEmailProvider[] = [
    'asat', 'ck_akdeniz', 'igdas', 'turkcell', 'generic', 'custom',
  ];
  return providers.includes(value as BillEmailProvider)
    ? (value as BillEmailProvider)
    : 'generic';
}

function normalizeInboxMode(value: unknown): BillEmailInboxMode {
  const modes: BillEmailInboxMode[] = ['dedicated_gmail', 'plus_alias', 'custom_imap'];
  return modes.includes(value as BillEmailInboxMode)
    ? (value as BillEmailInboxMode)
    : 'plus_alias';
}

function normalizeScope(value: unknown): PaymentScope {
  return value === 'company' ? 'company' : 'personal';
}

function normalizeCategory(value: unknown): PaymentReminderCategory {
  const categories: PaymentReminderCategory[] = [
    'rent', 'electricity', 'water', 'internet', 'tax', 'phone', 'insurance', 'salary', 'other',
  ];
  return categories.includes(value as PaymentReminderCategory)
    ? (value as PaymentReminderCategory)
    : 'other';
}

function normalizeSource(raw: unknown, index: number): BillEmailSource {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Partial<BillEmailSource>;
  const now = new Date().toISOString();
  const id = typeof item.id === 'string' && item.id.trim()
    ? item.id.trim()
    : `bill-email-${index + 1}`;
  return {
    id,
    label: typeof item.label === 'string' && item.label.trim() ? item.label.trim() : `Kaynak ${index + 1}`,
    provider: normalizeProvider(item.provider),
    forwardingAlias: typeof item.forwardingAlias === 'string' ? item.forwardingAlias.trim() : '',
    aliasTag: typeof item.aliasTag === 'string' ? item.aliasTag.trim() : undefined,
    scope: normalizeScope(item.scope),
    category: normalizeCategory(item.category),
    contractNumber: typeof item.contractNumber === 'string' ? item.contractNumber.trim() : undefined,
    senderFilter: typeof item.senderFilter === 'string' ? item.senderFilter.trim() : undefined,
    enabled: item.enabled !== false,
    linkedReminderId: typeof item.linkedReminderId === 'string' ? item.linkedReminderId : undefined,
    lastIngestedAt: typeof item.lastIngestedAt === 'string' ? item.lastIngestedAt : undefined,
    lastIngestedOk: typeof item.lastIngestedOk === 'boolean' ? item.lastIngestedOk : undefined,
    lastIngestedError: typeof item.lastIngestedError === 'string' ? item.lastIngestedError : undefined,
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : now,
  };
}

export function normalizeBillEmailIngestion(
  raw?: Partial<BillEmailIngestionSettings> | null,
): BillEmailIngestionSettings {
  const base = { ...DEFAULT_BILL_EMAIL_INGESTION, ...(raw ?? {}) };
  const sources = Array.isArray(raw?.sources) && raw.sources.length > 0
    ? raw.sources.map((item, index) => normalizeSource(item, index))
    : DEFAULT_BILL_EMAIL_INGESTION.sources.map((item) => ({ ...item }));

  const normalized: BillEmailIngestionSettings = {
    enabled: base.enabled === true,
    inboxMode: normalizeInboxMode(base.inboxMode),
    inboxAddress: typeof base.inboxAddress === 'string' ? base.inboxAddress.trim() : '',
    imapHost: typeof base.imapHost === 'string' && base.imapHost.trim()
      ? base.imapHost.trim()
      : 'imap.gmail.com',
    imapPort: Number.isFinite(Number(base.imapPort)) ? Number(base.imapPort) : 993,
    imapUser: typeof base.imapUser === 'string' ? base.imapUser.trim() : '',
    imapPassword: typeof base.imapPassword === 'string' ? base.imapPassword : '',
    pollIntervalMin: Number.isFinite(Number(base.pollIntervalMin)) && Number(base.pollIntervalMin) > 0
      ? Number(base.pollIntervalMin)
      : 30,
    sources,
    lastPollAt: typeof base.lastPollAt === 'string' ? base.lastPollAt : undefined,
    lastPollOk: typeof base.lastPollOk === 'boolean' ? base.lastPollOk : undefined,
    lastPollError: typeof base.lastPollError === 'string' ? base.lastPollError : undefined,
    lastPollMessage: typeof base.lastPollMessage === 'string' ? base.lastPollMessage : undefined,
  };

  return applyForwardingAliases(normalized);
}

/** Gmail +alias üretir: ahmet@gmail.com + asat-ev → ahmet+asat-ev@gmail.com */
export function buildPlusAlias(baseEmail: string, tag: string): string {
  const trimmed = baseEmail.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0) return '';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const cleanTag = tag.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/^-+|-+$/g, '');
  if (!cleanTag) return trimmed;
  const baseLocal = local.split('+')[0];
  return `${baseLocal}+${cleanTag}@${domain}`;
}

/** Kaynaklar için profil adreslerini moda göre hesaplar */
export function applyForwardingAliases(
  settings: BillEmailIngestionSettings,
): BillEmailIngestionSettings {
  const inbox = settings.inboxAddress.trim();
  const sources = settings.sources.map((source) => {
    let forwardingAlias = source.forwardingAlias.trim();

    if (settings.inboxMode === 'dedicated_gmail') {
      forwardingAlias = inbox;
    } else if (settings.inboxMode === 'plus_alias' && inbox) {
      const tag = source.aliasTag || source.id.replace(/^bill-email-/, '');
      forwardingAlias = buildPlusAlias(inbox, tag);
    }

    return {
      ...source,
      forwardingAlias,
    };
  });

  const imapUser = settings.imapUser.trim() || inbox;

  return {
    ...settings,
    imapUser,
    sources,
  };
}

export function createBillEmailSource(
  partial: Partial<BillEmailSource> & Pick<BillEmailSource, 'label'>,
): BillEmailSource {
  const now = new Date().toISOString();
  const id = partial.id?.trim() || `bill-email-${Date.now()}`;
  return normalizeSource({
    ...partial,
    id,
    createdAt: now,
    updatedAt: now,
  }, 0);
}
