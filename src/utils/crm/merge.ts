import type { Customer } from '../../types/business';
import type { Sale } from '../../types/product';
import type { CustomerLedgerEntry } from '../../types/accounting';
import type { CrmManualActivity, CrmPersistedData, CrmTask } from '../../types/crm';
import { getCustomerCrmProfile, normalizeCrmProfile, withUpdatedCrm } from './profile';
import type { CrmSettings } from '../../types/crm';

export function mergeCustomersData(
  primaryId: string,
  secondaryId: string,
  customers: Customer[],
  sales: Sale[],
  ledger: CustomerLedgerEntry[],
  crmData: CrmPersistedData,
  settings: CrmSettings,
): {
  customers: Customer[];
  sales: Sale[];
  ledger: CustomerLedgerEntry[];
  crmData: CrmPersistedData;
} | { error: string } {
  const primary = customers.find((c) => c.id === primaryId);
  const secondary = customers.find((c) => c.id === secondaryId);
  if (!primary || !secondary) return { error: 'Müşteri bulunamadı.' };
  if (primaryId === secondaryId) return { error: 'Aynı müşteri seçilemez.' };

  const pCrm = getCustomerCrmProfile(primary, settings);
  const sCrm = getCustomerCrmProfile(secondary, settings);
  const mergedProfile = normalizeCrmProfile({
    ...pCrm,
    tagIds: [...new Set([...pCrm.tagIds, ...sCrm.tagIds])],
    loyaltyPoints: pCrm.loyaltyPoints + sCrm.loyaltyPoints,
    communicationLog: [...pCrm.communicationLog, ...sCrm.communicationLog],
    documents: [...pCrm.documents, ...sCrm.documents],
    relatedContacts: [...pCrm.relatedContacts, ...sCrm.relatedContacts],
    customFields: { ...sCrm.customFields, ...pCrm.customFields },
  }, settings);

  const mergedPrimary = withUpdatedCrm(primary, mergedProfile, settings);

  const nextCustomers = customers
    .filter((c) => c.id !== secondaryId)
    .map((c) => (c.id === primaryId ? mergedPrimary : c));

  const nextSales = sales.map((sale) => {
    if (sale.customerId === secondaryId) {
      return { ...sale, customerId: primaryId, customerName: mergedPrimary.name };
    }
    return sale;
  });

  const nextLedger = ledger.map((entry) => (
    entry.customerId === secondaryId ? { ...entry, customerId: primaryId } : entry
  ));

  const nextTasks: CrmTask[] = crmData.tasks.map((t) => (
    t.customerId === secondaryId ? { ...t, customerId: primaryId } : t
  ));

  const nextActivities: CrmManualActivity[] = [
    ...crmData.manualActivities.map((a) => (
      a.customerId === secondaryId ? { ...a, customerId: primaryId } : a
    )),
    {
      id: `CRM-MERGE-${Date.now()}`,
      customerId: primaryId,
      kind: 'merge',
      title: 'Müşteri birleştirme',
      detail: `${secondary.name} (${secondaryId}) kaydı birleştirildi.`,
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    customers: nextCustomers,
    sales: nextSales,
    ledger: nextLedger,
    crmData: { ...crmData, tasks: nextTasks, manualActivities: nextActivities },
  };
}
