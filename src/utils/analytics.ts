import { getCategoryLabel } from '../data/categories';
import type { Customer } from '../types/business';
import type { Product, Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import { getCartLineKey } from '../types/saleReturn';
import { resolveProductBrand } from './productSearch';
import { isSaleLinkedToCustomer } from './saleCustomerLink';
import { getReturnedQuantityByLine, getSaleNetTotal, getSaleRefundedTotal } from './saleReturn';

export type ReportPeriod = 'today' | 'week' | 'month' | 'all';

export function filterSalesByPeriod(sales: Sale[], period: ReportPeriod): Sale[] {
  if (period === 'all') return sales;
  const now = new Date();
  const start = new Date(now);
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - 7);
  } else {
    start.setMonth(now.getMonth() - 1);
  }
  return sales.filter((s) => new Date(s.createdAt) >= start);
}

export function filterSalesByDateRange(sales: Sale[], from: string, to: string): Sale[] {
  if (!from && !to) return sales;

  const start = from ? new Date(`${from}T00:00:00`) : new Date(0);
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();

  if (start.getTime() > end.getTime()) return [];

  return sales.filter((sale) => {
    const createdAt = new Date(sale.createdAt);
    return createdAt >= start && createdAt <= end;
  });
}

export function formatReportDateLabel(isoDate: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${isoDate}T12:00:00`));
}

export function getPaymentBreakdown(sales: Sale[], saleReturns: SaleReturn[] = []) {
  const breakdown = { cash: 0, card: 0, transfer: 0, credit: 0 };
  for (const sale of sales) {
    if (sale.paymentMethod === 'split' && sale.paymentSplits?.length) {
      for (const split of sale.paymentSplits) {
        if (split.method in breakdown) {
          breakdown[split.method] += split.amount;
        }
      }
    } else if (sale.paymentMethod !== 'split' && sale.paymentMethod in breakdown) {
      breakdown[sale.paymentMethod] += sale.total;
    }
  }
  for (const entry of saleReturns) {
    breakdown[entry.refundMethod] -= entry.refundTotal;
  }
  return breakdown;
}

export function getCategoryRevenue(sales: Sale[], products: Product[]) {
  const map = new Map<string, number>();
  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productId == null) continue;
      const product = products.find((p) => p.id === item.productId);
      const cat = product?.category ?? 'other';
      map.set(cat, (map.get(cat) ?? 0) + item.unitPrice * item.quantity);
    }
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, label: getCategoryLabel(category), total }))
    .sort((a, b) => b.total - a.total);
}

export interface CategoryProductBreakdown {
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
}

export function getCategoryProductBreakdown(
  sales: Sale[],
  products: Product[],
  categoryId: string,
): CategoryProductBreakdown[] {
  const map = new Map<number, { quantity: number; revenue: number }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productId == null) continue;
      const product = products.find((p) => p.id === item.productId);
      const cat = product?.category ?? 'other';
      if (cat !== categoryId) continue;

      const current = map.get(item.productId) ?? { quantity: 0, revenue: 0 };
      current.quantity += item.quantity;
      current.revenue += item.unitPrice * item.quantity;
      map.set(item.productId, current);
    }
  }

  return [...map.entries()]
    .map(([productId, stats]) => ({
      productId,
      name: products.find((p) => p.id === productId)?.name ?? `#${productId}`,
      ...stats,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export interface BrandRevenueRow {
  brandKey: string;
  label: string;
  total: number;
  quantity: number;
  topProductId: number;
  topProductName: string;
  topProductQuantity: number;
  topProductRevenue: number;
}

export interface BrandProductBreakdown {
  productId: number;
  name: string;
  quantity: number;
  revenue: number;
}

function aggregateSalesByBrand(
  sales: Sale[],
  products: Product[],
): Map<string, {
  label: string;
  total: number;
  quantity: number;
  products: Map<number, { quantity: number; revenue: number }>;
}> {
  const map = new Map<string, {
    label: string;
    total: number;
    quantity: number;
    products: Map<number, { quantity: number; revenue: number }>;
  }>();

  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productId == null) continue;
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      const brand = resolveProductBrand(product.name);
      const lineRevenue = item.unitPrice * item.quantity;
      const current = map.get(brand.key) ?? {
        label: brand.label,
        total: 0,
        quantity: 0,
        products: new Map<number, { quantity: number; revenue: number }>(),
      };

      current.total += lineRevenue;
      current.quantity += item.quantity;

      const productStats = current.products.get(item.productId) ?? { quantity: 0, revenue: 0 };
      productStats.quantity += item.quantity;
      productStats.revenue += lineRevenue;
      current.products.set(item.productId, productStats);

      map.set(brand.key, current);
    }
  }

  return map;
}

function pickTopProduct(
  productMap: Map<number, { quantity: number; revenue: number }>,
  products: Product[],
): { productId: number; name: string; quantity: number; revenue: number } {
  const sorted = [...productMap.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const [productId, stats] = sorted[0] ?? [0, { quantity: 0, revenue: 0 }];
  return {
    productId,
    name: products.find((p) => p.id === productId)?.name ?? '—',
    quantity: stats.quantity,
    revenue: stats.revenue,
  };
}

export function getBrandRevenue(sales: Sale[], products: Product[]): BrandRevenueRow[] {
  const map = aggregateSalesByBrand(sales, products);

  return [...map.entries()]
    .map(([brandKey, stats]) => {
      const top = pickTopProduct(stats.products, products);
      return {
        brandKey,
        label: stats.label,
        total: stats.total,
        quantity: stats.quantity,
        topProductId: top.productId,
        topProductName: top.name,
        topProductQuantity: top.quantity,
        topProductRevenue: top.revenue,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function getBrandProductBreakdown(
  sales: Sale[],
  products: Product[],
  brandKey: string,
): BrandProductBreakdown[] {
  const map = aggregateSalesByBrand(sales, products);
  const brand = map.get(brandKey);
  if (!brand) return [];

  return [...brand.products.entries()]
    .map(([productId, stats]) => ({
      productId,
      name: products.find((p) => p.id === productId)?.name ?? `#${productId}`,
      ...stats,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function getTopProducts(sales: Sale[], products: Product[], limit = 5) {
  const map = new Map<number, { qty: number; revenue: number }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productId == null) continue;
      const current = map.get(item.productId) ?? { qty: 0, revenue: 0 };
      current.qty += item.quantity;
      current.revenue += item.unitPrice * item.quantity;
      map.set(item.productId, current);
    }
  }
  return [...map.entries()]
    .map(([id, stats]) => ({
      product: products.find((p) => p.id === id),
      ...stats,
    }))
    .filter((row) => row.product)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function estimateProfit(sales: Sale[], products: Product[]): number {
  let profit = 0;
  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productId == null) continue;
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;
      profit += (item.unitPrice - product.purchasePrice) * item.quantity;
    }
  }
  return profit;
}

export function getCustomerSales(
  sales: Sale[],
  customerId: string,
  customers: Customer[] = [],
): Sale[] {
  return sales
    .filter((sale) => isSaleLinkedToCustomer(sale, customerId, customers))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getCustomerSaleCount(
  sales: Sale[],
  customerId: string,
  customers: Customer[] = [],
): number {
  return getCustomerSales(sales, customerId, customers).length;
}

export interface CustomerProductSummary {
  productId: number;
  name: string;
  quantity: number;
  total: number;
  totalCost: number;
  totalProfit: number;
}

export function getCustomerPurchaseSummary(
  sales: Sale[],
  products: Product[],
  customerId: string,
  saleReturns: SaleReturn[] = [],
  customers: Customer[] = [],
) {
  const customerSales = getCustomerSales(sales, customerId, customers);
  const productMap = new Map<number, CustomerProductSummary>();

  for (const sale of customerSales) {
    for (const item of sale.items) {
      if (item.productId == null) continue;
      const lineKey = getCartLineKey(item);
      const returnedQuantity = getReturnedQuantityByLine(sale.id, lineKey, saleReturns);
      const netQuantity = item.quantity - returnedQuantity;
      if (netQuantity <= 0) continue;

      const existing = productMap.get(item.productId);
      const product = products.find((p) => p.id === item.productId);
      const lineTotal = item.unitPrice * netQuantity;
      const lineCost = (product?.purchasePrice ?? 0) * netQuantity;
      const lineProfit = lineTotal - lineCost;
      if (existing) {
        existing.quantity += netQuantity;
        existing.total += lineTotal;
        existing.totalCost += lineCost;
        existing.totalProfit += lineProfit;
      } else {
        productMap.set(item.productId, {
          productId: item.productId,
          name: product?.name ?? `Ürün #${item.productId}`,
          quantity: netQuantity,
          total: lineTotal,
          totalCost: lineCost,
          totalProfit: lineProfit,
        });
      }
    }
  }

  const productsSummary = [...productMap.values()].sort((a, b) => b.total - a.total);
  const totalSpent = customerSales.reduce((sum, sale) => sum + getSaleNetTotal(sale, saleReturns), 0);
  const totalRefunded = customerSales.reduce(
    (sum, sale) => sum + getSaleRefundedTotal(sale.id, saleReturns),
    0,
  );
  const totalCost = productsSummary.reduce((sum, item) => sum + item.totalCost, 0);
  const totalProfit = productsSummary.reduce((sum, item) => sum + item.totalProfit, 0);
  const totalItems = productsSummary.reduce((sum, item) => sum + item.quantity, 0);

  return {
    customerSales,
    productsSummary,
    totalSpent,
    totalRefunded,
    totalCost,
    totalProfit,
    totalItems,
    saleCount: customerSales.length,
  };
}
