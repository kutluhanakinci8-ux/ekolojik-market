import type { Customer } from '../../types/business';
import {
  createDefaultCrmProfile,
  type CrmSettings,
  type CustomerCrmProfile,
  type LoyaltyTier,
} from '../../types/crm';

export function normalizeCrmProfile(
  raw: Partial<CustomerCrmProfile> | undefined,
  settings: CrmSettings,
): CustomerCrmProfile {
  const base = createDefaultCrmProfile(settings);
  if (!raw) return base;

  return {
    status: raw.status ?? base.status,
    creditLimit: raw.creditLimit ?? base.creditLimit,
    defaultDueDays: raw.defaultDueDays ?? base.defaultDueDays,
    tagIds: Array.isArray(raw.tagIds) ? [...raw.tagIds] : base.tagIds,
    loyaltyPoints: typeof raw.loyaltyPoints === 'number' ? raw.loyaltyPoints : base.loyaltyPoints,
    loyaltyTier: raw.loyaltyTier ?? base.loyaltyTier,
    marketingConsent: {
      email: raw.marketingConsent?.email ?? base.marketingConsent.email,
      sms: raw.marketingConsent?.sms ?? base.marketingConsent.sms,
      consentedAt: raw.marketingConsent?.consentedAt,
    },
    birthDate: raw.birthDate,
    membershipStartedAt: raw.membershipStartedAt,
    customFields: raw.customFields && typeof raw.customFields === 'object' ? { ...raw.customFields } : {},
    relatedContacts: Array.isArray(raw.relatedContacts) ? raw.relatedContacts.map((c) => ({
      id: String(c.id ?? `RC${Date.now()}`),
      name: String(c.name ?? ''),
      phone: c.phone,
      email: c.email,
      role: c.role,
    })) : [],
    communicationLog: Array.isArray(raw.communicationLog) ? raw.communicationLog.map((e) => ({
      id: String(e.id ?? `CM${Date.now()}`),
      channel: e.channel ?? 'other',
      summary: String(e.summary ?? ''),
      createdAt: e.createdAt ?? new Date().toISOString(),
      createdBy: e.createdBy,
    })) : [],
    documents: Array.isArray(raw.documents) ? raw.documents.map((d) => ({
      id: String(d.id ?? `DOC${Date.now()}`),
      label: String(d.label ?? ''),
      note: d.note,
      createdAt: d.createdAt ?? new Date().toISOString(),
    })) : [],
    sponsorCustomerId: raw.sponsorCustomerId,
    anonymizedAt: raw.anonymizedAt,
    riskScore: raw.riskScore,
  };
}

export function getCustomerCrmProfile(customer: Customer, settings: CrmSettings): CustomerCrmProfile {
  return normalizeCrmProfile(customer.crm, settings);
}

export function resolveLoyaltyTier(points: number, settings: CrmSettings): LoyaltyTier {
  if (points >= settings.tierPlatinumMinPoints) return 'platinum';
  if (points >= settings.tierGoldMinPoints) return 'gold';
  if (points >= settings.tierSilverMinPoints) return 'silver';
  return 'bronze';
}

export function withUpdatedCrm(customer: Customer, patch: Partial<CustomerCrmProfile>, settings: CrmSettings): Customer {
  const merged = normalizeCrmProfile({ ...getCustomerCrmProfile(customer, settings), ...patch }, settings);
  merged.loyaltyTier = resolveLoyaltyTier(merged.loyaltyPoints, settings);
  return { ...customer, crm: merged, updatedAt: new Date().toISOString() };
}

export function isCustomerArchived(customer: Customer, settings: CrmSettings): boolean {
  const crm = getCustomerCrmProfile(customer, settings);
  return crm.status === 'archived' || Boolean(crm.anonymizedAt);
}
