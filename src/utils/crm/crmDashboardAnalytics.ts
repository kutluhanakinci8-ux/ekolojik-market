import type { Customer } from '../../types/business';
import type { CrmPersistedData } from '../../types/crm';
import type { CustomerLedgerEntry } from '../../types/accounting';
import type { Sale } from '../../types/product';
import type { SaleReturn } from '../../types/saleReturn';
import { buildCustomerBalanceRows } from '../accountingAnalytics';
import { computeCustomerRfm } from './rfm';
import { getCustomerCrmProfile } from './profile';
import type { CrmSettings } from '../../types/crm';

export interface CrmDashboardSummary {
  openLeads: number;
  openTasks: number;
  tasksDueToday: number;
  customersWithReceivable: number;
  totalReceivable: number;
  overdueReceivable: number;
  churnRiskCount: number;
  birthdaysThisWeek: number;
  smsTemplateCount: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isBirthdayThisWeek(birthDate?: string): boolean {
  if (!birthDate || birthDate.length < 10) return false;
  const [, month, day] = birthDate.split('-').map((v) => parseInt(v, 10));
  if (!month || !day) return false;
  const now = new Date();
  for (let offset = 0; offset < 7; offset += 1) {
    const probe = new Date(now);
    probe.setDate(probe.getDate() + offset);
    if (probe.getMonth() + 1 === month && probe.getDate() === day) return true;
  }
  return false;
}

export function buildCrmDashboardSummary(
  customers: Customer[],
  sales: Sale[],
  saleReturns: SaleReturn[],
  ledger: CustomerLedgerEntry[],
  crmData: CrmPersistedData,
  crmSettings: CrmSettings,
): CrmDashboardSummary {
  const balanceRows = buildCustomerBalanceRows(customers, ledger);
  const totalReceivable = balanceRows.reduce((sum, row) => sum + Math.max(0, row.balance), 0);
  const overdueReceivable = balanceRows.reduce((sum, row) => sum + row.overdueBalance, 0);
  const customersWithReceivable = balanceRows.filter((row) => row.balance > 0).length;

  const openLeads = crmData.leads.filter((l) => l.stage !== 'converted' && l.stage !== 'lost').length;
  const openTasks = crmData.tasks.filter((t) => t.status === 'open').length;
  const today = todayKey();
  const tasksDueToday = crmData.tasks.filter((t) => t.status === 'open' && t.dueDate === today).length;

  let churnRiskCount = 0;
  let birthdaysThisWeek = 0;
  for (const customer of customers) {
    const crm = getCustomerCrmProfile(customer, crmSettings);
    if (isBirthdayThisWeek(crm.birthDate)) birthdaysThisWeek += 1;
    const rfm = computeCustomerRfm(customer.id, sales, saleReturns, customers);
    if (rfm.segmentLabel === 'Uyuyan' && rfm.frequency > 0) churnRiskCount += 1;
  }

  return {
    openLeads,
    openTasks,
    tasksDueToday,
    customersWithReceivable,
    totalReceivable: Math.round(totalReceivable * 100) / 100,
    overdueReceivable: Math.round(overdueReceivable * 100) / 100,
    churnRiskCount,
    birthdaysThisWeek,
    smsTemplateCount: crmData.smsTemplates.length,
  };
}
