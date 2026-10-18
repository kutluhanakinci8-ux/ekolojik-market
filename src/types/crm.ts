import type { Customer } from './business';
import type { Product } from './product';
import type { Sale } from './product';
import type { SaleReturn } from './saleReturn';
import type { CustomerLedgerEntry } from './accounting';

export type CustomerCrmStatus = 'active' | 'inactive' | 'blacklist' | 'cash_only' | 'archived';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export type CrmLeadStage = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export type CrmTaskStatus = 'open' | 'done' | 'cancelled';

export type CrmCommunicationChannel = 'phone' | 'email' | 'whatsapp' | 'sms' | 'in_person' | 'other';

export type CrmActivityKind =
  | 'sale'
  | 'return'
  | 'payment'
  | 'note'
  | 'communication'
  | 'task'
  | 'lead'
  | 'loyalty'
  | 'campaign'
  | 'consent'
  | 'merge'
  | 'import';

export interface CrmRelatedContact {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role?: string;
}

export interface CrmCommunicationEntry {
  id: string;
  channel: CrmCommunicationChannel;
  summary: string;
  createdAt: string;
  createdBy?: string;
}

export interface CrmCustomerDocument {
  id: string;
  label: string;
  note?: string;
  /** IndexedDB/localStorage blob key */
  storageKey?: string;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
  createdAt: string;
}

export interface CustomerCrmProfile {
  status: CustomerCrmStatus;
  creditLimit?: number;
  defaultDueDays?: number;
  tagIds: string[];
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  marketingConsent: {
    email: boolean;
    sms: boolean;
    consentedAt?: string;
  };
  birthDate?: string;
  membershipStartedAt?: string;
  customFields: Record<string, string>;
  relatedContacts: CrmRelatedContact[];
  communicationLog: CrmCommunicationEntry[];
  documents: CrmCustomerDocument[];
  sponsorCustomerId?: string;
  anonymizedAt?: string;
  riskScore?: number;
}

export interface CrmTagDefinition {
  id: string;
  label: string;
  color: string;
}

export interface CrmSegmentRule {
  id: string;
  field: 'days_since_purchase' | 'lifetime_spend' | 'open_balance' | 'loyalty_tier' | 'tag';
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'includes';
  value: string;
}

export interface CrmSavedSegment {
  id: string;
  name: string;
  rules: CrmSegmentRule[];
  createdAt: string;
}

export type CrmCampaignDiscountType = 'percent' | 'fixed' | 'min_cart_percent';

export interface CrmCampaign {
  id: string;
  name: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  segmentId?: string;
  tagIds: string[];
  discountType: CrmCampaignDiscountType;
  discountValue: number;
  minCartTotal?: number;
  createdAt: string;
}

export interface CrmCoupon {
  id: string;
  code: string;
  campaignId?: string;
  active: boolean;
  maxUses: number;
  usedCount: number;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  minCartTotal?: number;
  expiresAt?: string;
  customerId?: string;
  createdAt: string;
}

export interface CrmLead {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  source?: string;
  stage: CrmLeadStage;
  notes?: string;
  convertedCustomerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmTask {
  id: string;
  customerId?: string;
  leadId?: string;
  title: string;
  dueDate?: string;
  status: CrmTaskStatus;
  assignedTo?: string;
  createdAt: string;
  completedAt?: string;
}

export interface CrmManualActivity {
  id: string;
  customerId: string;
  kind: CrmActivityKind;
  title: string;
  detail?: string;
  createdAt: string;
  createdBy?: string;
}

export interface CrmSmsTemplate {
  id: string;
  name: string;
  /** {{name}}, {{business}}, {{balance}}, {{points}}, {{dueDate}}, {{greenleaf}} */
  body: string;
  createdAt: string;
}

export interface CrmEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
}

export type CrmAutomationTrigger =
  | 'days_since_purchase'
  | 'birthday_today'
  | 'overdue_balance'
  | 'segment_match';

export type CrmOutreachChannel = 'sms' | 'email';

export type CrmOutreachStatus = 'pending' | 'sent' | 'failed' | 'skipped';

export interface CrmAutomationFlow {
  id: string;
  name: string;
  active: boolean;
  trigger: CrmAutomationTrigger;
  /** gün sayısı, segment id, vb. */
  triggerValue: string;
  segmentId?: string;
  channel: CrmOutreachChannel;
  smsTemplateId?: string;
  emailTemplateId?: string;
  lastRunAt?: string;
  createdAt: string;
}

export interface CrmOutreachQueueItem {
  id: string;
  customerId: string;
  channel: CrmOutreachChannel;
  subject?: string;
  body: string;
  status: CrmOutreachStatus;
  automationFlowId?: string;
  scheduledAt: string;
  sentAt?: string;
  error?: string;
}

export interface CrmSettings {
  pointsPerTry: number;
  pointsPerPv: number;
  tryPerPointRedeem: number;
  tierSilverMinPoints: number;
  tierGoldMinPoints: number;
  tierPlatinumMinPoints: number;
  defaultCreditLimit?: number;
  defaultDueDays: number;
  autoCollectionReminderDays: number;
  birthdayBonusPoints: number;
  referralBonusPoints: number;
  automationEnabled: boolean;
  /** Günlük otomasyon en fazla bir kez çalışsın (YYYY-MM-DD) */
  automationLastRunDate?: string;
  emailFromName?: string;
  emailReplyTo?: string;
}

export const DEFAULT_CRM_SETTINGS: CrmSettings = {
  pointsPerTry: 1,
  pointsPerPv: 0,
  tryPerPointRedeem: 0.1,
  tierSilverMinPoints: 500,
  tierGoldMinPoints: 2000,
  tierPlatinumMinPoints: 5000,
  defaultDueDays: 30,
  autoCollectionReminderDays: 3,
  birthdayBonusPoints: 50,
  referralBonusPoints: 100,
  automationEnabled: true,
  emailFromName: 'Greenleaf Market',
};

export interface CrmPersistedData {
  tagDefinitions: CrmTagDefinition[];
  segments: CrmSavedSegment[];
  campaigns: CrmCampaign[];
  coupons: CrmCoupon[];
  leads: CrmLead[];
  tasks: CrmTask[];
  manualActivities: CrmManualActivity[];
  smsTemplates: CrmSmsTemplate[];
  emailTemplates: CrmEmailTemplate[];
  automationFlows: CrmAutomationFlow[];
  outreachQueue: CrmOutreachQueueItem[];
}

export const EMPTY_CRM_DATA: CrmPersistedData = {
  tagDefinitions: [],
  segments: [],
  campaigns: [],
  coupons: [],
  leads: [],
  tasks: [],
  manualActivities: [],
  smsTemplates: [],
  emailTemplates: [],
  automationFlows: [],
  outreachQueue: [],
};

export interface CustomerCohortRow {
  cohortMonth: string;
  customerCount: number;
  repeatRate: number;
  revenue: number;
}

export interface CustomerClvRow {
  customerId: string;
  customerName: string;
  clvEstimate: number;
  orderCount: number;
  avgOrderValue: number;
}

export interface CrmTimelineItem {
  id: string;
  at: string;
  kind: CrmActivityKind;
  title: string;
  detail?: string;
  amount?: number;
}

export interface CrmCheckoutPreview {
  subtotal: number;
  campaignDiscount: number;
  couponDiscount: number;
  loyaltyDiscount: number;
  total: number;
  pointsToEarn: number;
  pointsRedeemed: number;
  campaignId?: string;
  couponId?: string;
  couponError?: string;
  creditError?: string;
  blockedReason?: string;
}

export interface CustomerRfmScores {
  recencyDays: number;
  frequency: number;
  monetary: number;
  segmentLabel: string;
}

export function createDefaultCrmProfile(settings: CrmSettings): CustomerCrmProfile {
  return {
    status: 'active',
    creditLimit: settings.defaultCreditLimit,
    defaultDueDays: settings.defaultDueDays,
    tagIds: [],
    loyaltyPoints: 0,
    loyaltyTier: 'bronze',
    marketingConsent: { email: false, sms: false },
    customFields: {},
    relatedContacts: [],
    communicationLog: [],
    documents: [],
  };
}

export interface CrmBuildContext {
  customers: Customer[];
  sales: Sale[];
  saleReturns: SaleReturn[];
  customerLedger: CustomerLedgerEntry[];
  products: Product[];
  crmData: CrmPersistedData;
  settings: CrmSettings;
}
