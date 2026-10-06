import type { Customer } from '../../types/business';
import type { CustomerLedgerEntry } from '../../types/accounting';
import type { Sale } from '../../types/product';
import type { SaleReturn } from '../../types/saleReturn';
import type {
  CrmAutomationFlow,
  CrmOutreachQueueItem,
  CrmPersistedData,
  CrmSettings,
} from '../../types/crm';
import { buildCustomerBalanceRows } from '../accountingAnalytics';
import { getCustomerCrmProfile } from './profile';
import { customerMatchesSegment } from './segments';
import { resolveSaleCustomerId } from '../saleCustomerLink';
import { getSaleNetTotal } from '../saleReturn';
import { buildSmsContext, renderSmsTemplate } from './smsTemplates';
import { renderEmailTemplate } from './emailTemplates';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function lastPurchaseDate(
  customerId: string,
  sales: Sale[],
  saleReturns: SaleReturn[],
  customers: Customer[],
): string | null {
  let latest: string | null = null;
  for (const sale of sales) {
    if (resolveSaleCustomerId(sale, customers) !== customerId) continue;
    if (getSaleNetTotal(sale, saleReturns) <= 0) continue;
    if (!latest || sale.createdAt > latest) latest = sale.createdAt;
  }
  return latest;
}

function isBirthdayToday(birthDate?: string): boolean {
  if (!birthDate || birthDate.length < 10) return false;
  const today = new Date();
  const [, m, d] = birthDate.split('-').map((v) => parseInt(v, 10));
  return m === today.getMonth() + 1 && d === today.getDate();
}

function alreadyQueued(
  queue: CrmOutreachQueueItem[],
  customerId: string,
  flowId: string,
  day: string,
): boolean {
  return queue.some((q) => (
    q.customerId === customerId
    && q.automationFlowId === flowId
    && q.scheduledAt.startsWith(day)
  ));
}

export function evaluateAutomationTargets(
  flow: CrmAutomationFlow,
  customers: Customer[],
  sales: Sale[],
  saleReturns: SaleReturn[],
  ledger: CustomerLedgerEntry[],
  crmData: CrmPersistedData,
  crmSettings: CrmSettings,
): Customer[] {
  const segment = flow.segmentId
    ? crmData.segments.find((s) => s.id === flow.segmentId)
    : undefined;

  return customers.filter((customer) => {
    const crm = getCustomerCrmProfile(customer, crmSettings);
    if (crm.anonymizedAt || crm.status === 'archived') return false;
    if (segment && !customerMatchesSegment(segment, customer, sales, saleReturns, customers, ledger, crmSettings)) {
      return false;
    }

    switch (flow.trigger) {
      case 'days_since_purchase': {
        const threshold = parseInt(flow.triggerValue, 10);
        if (Number.isNaN(threshold)) return false;
        const last = lastPurchaseDate(customer.id, sales, saleReturns, customers);
        if (!last) return threshold >= 999;
        return daysSince(last) >= threshold;
      }
      case 'birthday_today':
        return isBirthdayToday(crm.birthDate);
      case 'overdue_balance': {
        const rows = buildCustomerBalanceRows(customers, ledger);
        const row = rows.find((r) => r.customerId === customer.id);
        return (row?.overdueBalance ?? 0) > 0;
      }
      case 'segment_match':
        return Boolean(segment);
      default:
        return false;
    }
  });
}

export function buildOutreachForCustomer(
  flow: CrmAutomationFlow,
  customer: Customer,
  businessName: string,
  balance: number,
  crmData: CrmPersistedData,
  crmSettings: CrmSettings,
): Omit<CrmOutreachQueueItem, 'id' | 'scheduledAt' | 'status'> | null {
  const crm = getCustomerCrmProfile(customer, crmSettings);
  const ctx = buildSmsContext(customer, businessName, balance, crm.loyaltyPoints);

  if (flow.channel === 'sms') {
    if (!crm.marketingConsent.sms) return null;
    const template = crmData.smsTemplates.find((t) => t.id === flow.smsTemplateId);
    if (!template) return null;
    return {
      customerId: customer.id,
      channel: 'sms',
      body: renderSmsTemplate(template.body, ctx),
      automationFlowId: flow.id,
    };
  }

  if (!crm.marketingConsent.email || !customer.email) return null;
  const template = crmData.emailTemplates.find((t) => t.id === flow.emailTemplateId);
  if (!template) return null;
  const rendered = renderEmailTemplate(template, ctx);
  return {
    customerId: customer.id,
    channel: 'email',
    subject: rendered.subject,
    body: rendered.body,
    automationFlowId: flow.id,
  };
}

export function runDailyAutomation(
  customers: Customer[],
  sales: Sale[],
  saleReturns: SaleReturn[],
  ledger: CustomerLedgerEntry[],
  crmData: CrmPersistedData,
  crmSettings: CrmSettings,
  businessName: string,
): { crmData: CrmPersistedData; settings: CrmSettings; enqueued: number } {
  const day = todayKey();
  if (!crmSettings.automationEnabled || crmSettings.automationLastRunDate === day) {
    return { crmData, settings: crmSettings, enqueued: 0 };
  }

  const balanceRows = buildCustomerBalanceRows(customers, ledger);
  const queue = [...crmData.outreachQueue];
  let enqueued = 0;
  const flows = crmData.automationFlows.map((f) => ({ ...f }));

  for (const flow of flows) {
    if (!flow.active) continue;
    const targets = evaluateAutomationTargets(
      flow,
      customers,
      sales,
      saleReturns,
      ledger,
      crmData,
      crmSettings,
    );
    for (const customer of targets) {
      if (alreadyQueued(queue, customer.id, flow.id, day)) continue;
      const balance = balanceRows.find((r) => r.customerId === customer.id)?.balance ?? 0;
      const draft = buildOutreachForCustomer(flow, customer, businessName, balance, crmData, crmSettings);
      if (!draft) continue;
      queue.unshift({
        ...draft,
        id: `OUT-${Date.now()}-${enqueued}`,
        status: 'pending',
        scheduledAt: new Date().toISOString(),
      });
      enqueued += 1;
    }
    flow.lastRunAt = new Date().toISOString();
  }

  return {
    crmData: {
      ...crmData,
      outreachQueue: queue.slice(0, 500),
      automationFlows: flows,
    },
    settings: { ...crmSettings, automationLastRunDate: day },
    enqueued,
  };
}
