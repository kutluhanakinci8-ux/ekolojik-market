import type { Product } from '../types/product';
import { DEFAULT_VAT_RATE, roundMoney, splitGrossAmount } from './vatAnalytics';

export interface ProfitMarginReportRow {
  productId: number;
  productCode: string;
  barcode: string;
  name: string;
  stock: number;
  purchaseNet: number;
  partnerNet: number;
  retailNet: number;
  partnerMarginPct: number | null;
  retailMarginPct: number | null;
}

export function purchasePriceNetExVat(purchaseGross: number): number {
  if (purchaseGross <= 0) return 0;
  return splitGrossAmount(purchaseGross, DEFAULT_VAT_RATE).netAmount;
}

export function marginPercentOnCost(costNet: number, saleNet: number): number | null {
  if (costNet <= 0 || saleNet <= 0) return null;
  const pct = ((saleNet - costNet) / costNet) * 100;
  return Math.round(pct * 10) / 10;
}

export function buildProfitMarginReportRows(products: Product[]): ProfitMarginReportRow[] {
  const rows = products.map((product) => {
    const purchaseNet = roundMoney(purchasePriceNetExVat(product.purchasePrice ?? 0));
    const partnerNet = roundMoney(product.partnerPrice ?? 0);
    const retailNet = roundMoney(product.fullSalePrice ?? 0);
    return {
      productId: product.id,
      productCode: (product.productCode ?? '').trim() || `No ${product.id}`,
      barcode: (product.barcode ?? '').trim(),
      name: product.name,
      stock: product.stock ?? 0,
      purchaseNet,
      partnerNet,
      retailNet,
      partnerMarginPct: marginPercentOnCost(purchaseNet, partnerNet),
      retailMarginPct: marginPercentOnCost(purchaseNet, retailNet),
    };
  });

  return rows.sort((a, b) => a.productCode.localeCompare(b.productCode, 'tr'));
}

export function formatMarginPercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1).replace('.', ',')}%`;
}
