import type { Customer } from '../../types/business';
import type { Sale } from '../../types/product';
import type { SaleReturn } from '../../types/saleReturn';
import { resolveSaleCustomerId } from '../saleCustomerLink';
import { getSaleNetTotal } from '../saleReturn';
import type { CustomerRfmScores } from '../../types/crm';

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function computeCustomerRfm(
  customerId: string,
  sales: Sale[],
  saleReturns: SaleReturn[],
  customers: Customer[],
): CustomerRfmScores {
  let lastAt: string | null = null;
  let frequency = 0;
  let monetary = 0;

  for (const sale of sales) {
    if (resolveSaleCustomerId(sale, customers) !== customerId) continue;
    const net = getSaleNetTotal(sale, saleReturns);
    if (net <= 0) continue;
    frequency += 1;
    monetary += net;
    if (!lastAt || sale.createdAt > lastAt) lastAt = sale.createdAt;
  }

  const recencyDays = lastAt ? daysSince(lastAt) : 9999;
  monetary = Math.round(monetary * 100) / 100;

  let segmentLabel = 'Uyuyan';
  if (frequency >= 5 && recencyDays <= 30 && monetary >= 5000) segmentLabel = 'Şampiyon';
  else if (recencyDays <= 60 && monetary >= 2000) segmentLabel = 'Sadık';
  else if (recencyDays <= 90) segmentLabel = 'Potansiyel';
  else if (frequency === 0) segmentLabel = 'Yeni / pasif';

  return { recencyDays, frequency, monetary, segmentLabel };
}
