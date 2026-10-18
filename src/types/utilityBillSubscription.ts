import type { PaymentScope } from './paymentReminder';

export type UtilityProvider = 'asat' | 'faturaodemelisin' | 'odemecomtr';

export interface UtilityBillAutoSyncSettings {
  enabled: boolean;
  /** HH:mm Türkiye saati */
  dailyTime: string;
  lastRunAt?: string;
}

export const DEFAULT_UTILITY_BILL_AUTO_SYNC: UtilityBillAutoSyncSettings = {
  enabled: true,
  dailyTime: '09:00',
};

export interface UtilityBillSubscription {
  id: string;
  provider: UtilityProvider;
  /** ASAT sözleşme veya muhatap numarası */
  contractNumber: string;
  label: string;
  scope: PaymentScope;
  enabled: boolean;
  linkedReminderId?: string;
  lastSyncAt?: string;
  lastSyncOk?: boolean;
  lastSyncError?: string;
  lastSyncDiagnostics?: string;
  lastBalance?: number;
  /** YYYY-MM-DD */
  lastDueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type AsatDiagnosticReason =
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_UNREACHABLE'
  | 'CAPTCHA_REQUIRED'
  | 'NO_DEBT_DATA'
  | 'PORTAL_HTTP_ERROR'
  | 'OK';

export interface AsatDiagnosticCheck {
  target: string;
  ok: boolean;
  status?: number;
  latencyMs?: number;
  detail: string;
}

export interface AsatDiagnostics {
  checkedAt: string;
  onlinePortalReachable: boolean;
  mainSiteReachable: boolean;
  reason: AsatDiagnosticReason;
  summary: string;
  recommendation: string;
  checks: AsatDiagnosticCheck[];
}

export interface AsatDebtQueryResult {
  ok: boolean;
  contractNumber: string;
  balance?: number;
  dueDate?: string;
  message?: string;
  source?: 'asat_portal' | 'manual';
  diagnostics?: AsatDiagnostics;
  /** @deprecated eski API yanıtı */
  subscriberNumber?: string;
}

export const ASAT_SCOPE_LABELS: Record<PaymentScope, string> = {
  company: 'İşyeri',
  personal: 'Ev',
};

const NOW = '2026-01-01T00:00:00.000Z';

export const DEFAULT_UTILITY_BILL_SUBSCRIPTIONS: UtilityBillSubscription[] = [
  {
    id: 'ASAT-385092',
    provider: 'asat',
    contractNumber: '385092',
    label: 'ASAT Ev',
    scope: 'personal',
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'ASAT-1002109637',
    provider: 'asat',
    contractNumber: '1002109637',
    label: 'ASAT İşyeri',
    scope: 'company',
    enabled: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

const LEGACY_CONTRACT_MAP: Record<string, {
  contractNumber: string;
  scope: PaymentScope;
  label: string;
  id: string;
}> = {
  '385092V': {
    id: 'ASAT-385092',
    contractNumber: '385092',
    scope: 'personal',
    label: 'ASAT Ev',
  },
  '385092': {
    id: 'ASAT-385092',
    contractNumber: '385092',
    scope: 'personal',
    label: 'ASAT Ev',
  },
  '133972': {
    id: 'ASAT-1002109637',
    contractNumber: '1002109637',
    scope: 'company',
    label: 'ASAT İşyeri',
  },
  '1002109637': {
    id: 'ASAT-1002109637',
    contractNumber: '1002109637',
    scope: 'company',
    label: 'ASAT İşyeri',
  },
};

function normalizeContractNumber(raw: string): string {
  const trimmed = raw.trim();
  const legacy = LEGACY_CONTRACT_MAP[trimmed.toUpperCase()] ?? LEGACY_CONTRACT_MAP[trimmed];
  if (legacy) return legacy.contractNumber;
  return trimmed.replace(/[^0-9A-Za-z]/g, '').replace(/V$/i, '') || trimmed;
}

function getCanonicalForContract(contractNumber: string) {
  const fromLegacy = Object.values(LEGACY_CONTRACT_MAP).find((item) => item.contractNumber === contractNumber);
  if (fromLegacy) return fromLegacy;
  const fromDefault = DEFAULT_UTILITY_BILL_SUBSCRIPTIONS.find((item) => item.contractNumber === contractNumber);
  if (fromDefault) {
    return {
      id: fromDefault.id,
      contractNumber: fromDefault.contractNumber,
      scope: fromDefault.scope,
      label: fromDefault.label,
    };
  }
  return null;
}

function resolveSubscription(
  item: Partial<UtilityBillSubscription> & { subscriberNumber?: string },
): UtilityBillSubscription | null {
  const rawNumber = String(item.contractNumber ?? item.subscriberNumber ?? '').trim();
  if (!rawNumber) return null;

  const legacy = LEGACY_CONTRACT_MAP[rawNumber.toUpperCase()] ?? LEGACY_CONTRACT_MAP[rawNumber];
  const contractNumber = legacy?.contractNumber ?? normalizeContractNumber(rawNumber);
  const canonical = getCanonicalForContract(contractNumber);
  const scope = canonical?.scope ?? (item.scope === 'personal' ? 'personal' : 'company');
  const id = canonical?.id ?? legacy?.id ?? item.id ?? `ASAT-${contractNumber}`;
  const label = canonical?.label ?? legacy?.label ?? `ASAT ${ASAT_SCOPE_LABELS[scope]}`;

  return {
    id,
    provider: item.provider === 'asat'
      ? 'asat'
      : item.provider === 'faturaodemelisin'
        ? 'faturaodemelisin'
        : 'odemecomtr',
    contractNumber,
    label,
    scope,
    enabled: item.enabled !== false,
    linkedReminderId: item.linkedReminderId,
    lastSyncAt: item.lastSyncAt,
    lastSyncOk: item.lastSyncOk,
    lastSyncError: item.lastSyncError,
    lastSyncDiagnostics: item.lastSyncDiagnostics,
    lastBalance: item.lastBalance,
    lastDueDate: item.lastDueDate,
    createdAt: item.createdAt || NOW,
    updatedAt: item.updatedAt || NOW,
  };
}

function isStaleAsatPortalMessage(text?: string): boolean {
  if (!text) return false;
  return /online\.asat\.gov\.tr|ASAT ana sitesi|ASAT online portal|VPS ağı|odenmemisBorclarAnonym/i.test(text);
}

function sanitizeSyncFields(fields: Partial<UtilityBillSubscription>): Partial<UtilityBillSubscription> {
  const staleError = isStaleAsatPortalMessage(fields.lastSyncError);
  const staleDiagnostics = isStaleAsatPortalMessage(fields.lastSyncDiagnostics);
  if (!staleError && !staleDiagnostics) return fields;
  return {
    ...fields,
    lastSyncError: staleError ? undefined : fields.lastSyncError,
    lastSyncDiagnostics: staleDiagnostics ? undefined : fields.lastSyncDiagnostics,
    lastSyncOk: staleError || staleDiagnostics ? undefined : fields.lastSyncOk,
  };
}

function pickSyncFields(item: UtilityBillSubscription): Partial<UtilityBillSubscription> {
  return sanitizeSyncFields({
    linkedReminderId: item.linkedReminderId,
    lastSyncAt: item.lastSyncAt,
    lastSyncOk: item.lastSyncOk,
    lastSyncError: item.lastSyncError,
    lastSyncDiagnostics: item.lastSyncDiagnostics,
    lastBalance: item.lastBalance,
    lastDueDate: item.lastDueDate,
  });
}

export function normalizeUtilityBillSubscriptions(
  raw?: UtilityBillSubscription[],
): UtilityBillSubscription[] {
  const syncByContract = new Map<string, Partial<UtilityBillSubscription>>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      const resolved = resolveSubscription(item);
      if (!resolved) continue;
      const prev = syncByContract.get(resolved.contractNumber) ?? {};
      const next = pickSyncFields(resolved);
      syncByContract.set(resolved.contractNumber, {
        linkedReminderId: next.linkedReminderId ?? prev.linkedReminderId,
        lastSyncAt: next.lastSyncAt ?? prev.lastSyncAt,
        lastSyncOk: next.lastSyncOk ?? prev.lastSyncOk,
        lastSyncError: next.lastSyncError ?? prev.lastSyncError,
        lastSyncDiagnostics: next.lastSyncDiagnostics ?? prev.lastSyncDiagnostics,
        lastBalance: next.lastBalance ?? prev.lastBalance,
        lastDueDate: next.lastDueDate ?? prev.lastDueDate,
      });
    }
  }

  return DEFAULT_UTILITY_BILL_SUBSCRIPTIONS.map((base) => ({
    ...base,
    ...(syncByContract.get(base.contractNumber) ?? {}),
  }));
}
