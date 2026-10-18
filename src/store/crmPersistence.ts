import { DEFAULT_CRM_SETTINGS, EMPTY_CRM_DATA, type CrmPersistedData } from '../types/crm';
import { normalizeSmsTemplates } from '../utils/crm/smsTemplates';
import { normalizeEmailTemplates } from '../utils/crm/emailTemplates';
import type { AppSettings } from '../types/business';
import { DEFAULT_SETTINGS } from '../types/business';

import { tenantLocalStorageSuffix } from '../storage/posLocalStorageKeys';

function crmStorageKey(): string {
  return `market-pos-crm${tenantLocalStorageSuffix()}`;
}

export function normalizeCrmData(raw?: Partial<CrmPersistedData> | null): CrmPersistedData {
  if (!raw) return { ...EMPTY_CRM_DATA };
  return {
    tagDefinitions: Array.isArray(raw.tagDefinitions) ? raw.tagDefinitions : [],
    segments: Array.isArray(raw.segments) ? raw.segments : [],
    campaigns: Array.isArray(raw.campaigns) ? raw.campaigns : [],
    coupons: Array.isArray(raw.coupons) ? raw.coupons : [],
    leads: Array.isArray(raw.leads) ? raw.leads : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    manualActivities: Array.isArray(raw.manualActivities) ? raw.manualActivities : [],
    smsTemplates: normalizeSmsTemplates(raw.smsTemplates),
    emailTemplates: normalizeEmailTemplates(raw.emailTemplates),
    automationFlows: Array.isArray(raw.automationFlows) ? raw.automationFlows : [],
    outreachQueue: Array.isArray(raw.outreachQueue) ? raw.outreachQueue : [],
  };
}

export function getCrmSettings(settings: AppSettings) {
  return { ...DEFAULT_CRM_SETTINGS, ...(settings.crm ?? DEFAULT_SETTINGS.crm) };
}

export function loadCrmData(): CrmPersistedData {
  const stored = localStorage.getItem(crmStorageKey());
  if (!stored) return { ...EMPTY_CRM_DATA };
  try {
    return normalizeCrmData(JSON.parse(stored) as CrmPersistedData);
  } catch {
    return { ...EMPTY_CRM_DATA };
  }
}

export function saveCrmDataLocal(data: CrmPersistedData) {
  localStorage.setItem(crmStorageKey(), JSON.stringify(data));
}
