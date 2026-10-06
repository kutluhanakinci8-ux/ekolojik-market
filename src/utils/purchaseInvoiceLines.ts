import type { PurchaseInvoiceLine } from '../types/accounting';
import type { Product } from '../types/product';
import type { VoucherSearchOption } from '../utils/voucherEntityInlineSearch';
import { parseAmountInput } from './voucherForm';
import { splitGrossAmount } from './vatAnalytics';

export interface PurchaseLineDraft {
  key: string;
  productId: string;
  quantity: string;
  unitCostNet: string;
  vatRate: string;
  pv: string;
  purchasePriceGross: string;
  partnerPrice: string;
  couponPrice: string;
  fullSalePrice: string;
  wholesalePrice: string;
}

export function createEmptyPurchaseLineDraft(): PurchaseLineDraft {
  return {
    key: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productId: '',
    quantity: '1',
    unitCostNet: '',
    vatRate: '20',
    pv: '',
    purchasePriceGross: '',
    partnerPrice: '',
    couponPrice: '',
    fullSalePrice: '',
    wholesalePrice: '',
  };
}

function parseOptionalAmount(value: string): number | undefined {
  const parsed = parseAmountInput(value);
  return parsed > 0 ? parsed : undefined;
}

function parseOptionalPv(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = parseFloat(trimmed.replace(',', '.'));
  return Number.isNaN(parsed) || parsed < 0 ? undefined : parsed;
}

export function grossFromNetUnit(unitCostNet: number, vatRate: number): number {
  return Math.round(unitCostNet * (1 + vatRate / 100) * 100) / 100;
}

export function netFromGrossUnit(gross: number, vatRate: number): number {
  if (gross <= 0 || vatRate < 0) return 0;
  return Math.round((gross / (1 + vatRate / 100)) * 100) / 100;
}

export function fillPurchaseLineDraftFromProduct(
  draft: PurchaseLineDraft,
  product: Product,
): PurchaseLineDraft {
  const wholesale = product.wholesalePrices?.qty10;
  const vatRate = parseFloat(draft.vatRate.replace(',', '.')) || 20;
  const unitCostNet = parseAmountInput(draft.unitCostNet) > 0
    ? draft.unitCostNet
    : product.purchasePrice > 0
      ? String(netFromGrossUnit(product.purchasePrice, vatRate))
      : draft.unitCostNet;
  return {
    ...draft,
    unitCostNet,
    pv: String(product.pv ?? ''),
    purchasePriceGross: product.purchasePrice > 0 ? String(product.purchasePrice) : draft.purchasePriceGross,
    partnerPrice: product.partnerPrice > 0 ? String(product.partnerPrice) : '',
    couponPrice: product.couponPrice != null && product.couponPrice > 0 ? String(product.couponPrice) : '',
    fullSalePrice: product.fullSalePrice > 0 ? String(product.fullSalePrice) : '',
    wholesalePrice: wholesale != null && wholesale > 0 ? String(wholesale) : '',
  };
}

export function buildProductVoucherSearchOptions(products: Product[]): VoucherSearchOption[] {
  return products.map((product) => {
    const stockNo = String(product.id);
    const code = product.productCode?.trim();
    return {
      id: stockNo,
      label: product.name,
      hint: [code ? `Kod ${code}` : null, `Stok #${stockNo}`, product.category].filter(Boolean).join(' · '),
      searchText: [stockNo, code, product.name, product.category].filter(Boolean).join(' '),
    };
  });
}

export function parsePurchaseLineDrafts(
  drafts: PurchaseLineDraft[],
): PurchaseInvoiceLine[] {
  const lines: PurchaseInvoiceLine[] = [];
  for (const draft of drafts) {
    const productId = Number.parseInt(draft.productId, 10);
    const quantity = parseFloat(draft.quantity.replace(',', '.')) || 0;
    const unitCostNet = parseAmountInput(draft.unitCostNet);
    const vatRate = parseFloat(draft.vatRate.replace(',', '.')) || 0;
    if (!productId || quantity <= 0 || unitCostNet <= 0) continue;
    const purchasePrice = parseOptionalAmount(draft.purchasePriceGross)
      ?? grossFromNetUnit(unitCostNet, vatRate);
    lines.push({
      productId,
      quantity,
      unitCostNet,
      vatRate,
      pv: parseOptionalPv(draft.pv),
      purchasePrice,
      partnerPrice: parseOptionalAmount(draft.partnerPrice),
      couponPrice: parseOptionalAmount(draft.couponPrice),
      fullSalePrice: parseOptionalAmount(draft.fullSalePrice),
      wholesalePrice: parseOptionalAmount(draft.wholesalePrice),
    });
  }
  return lines;
}

export function computePurchaseLinesTotals(lines: PurchaseInvoiceLine[]) {
  let grossAmount = 0;
  let netAmount = 0;
  let vatAmount = 0;

  for (const line of lines) {
    const lineGross = Math.round(
      line.unitCostNet * line.quantity * (1 + line.vatRate / 100) * 100,
    ) / 100;
    const split = splitGrossAmount(lineGross, line.vatRate);
    grossAmount += split.grossAmount;
    netAmount += split.netAmount;
    vatAmount += split.vatAmount;
  }

  grossAmount = Math.round(grossAmount * 100) / 100;
  netAmount = Math.round(netAmount * 100) / 100;
  vatAmount = Math.round(vatAmount * 100) / 100;
  const vatRate = netAmount > 0 ? Math.round((vatAmount / netAmount) * 1000) / 10 : 20;

  return { grossAmount, netAmount, vatAmount, vatRate };
}

export function purchaseLineDraftsFromInvoiceLines(lines: PurchaseInvoiceLine[]): PurchaseLineDraft[] {
  return lines.map((line) => ({
    key: `pl-${line.productId}-${Math.random().toString(36).slice(2, 7)}`,
    productId: String(line.productId),
    quantity: String(line.quantity),
    unitCostNet: String(line.unitCostNet),
    vatRate: String(line.vatRate),
    pv: line.pv != null ? String(line.pv) : '',
    purchasePriceGross: line.purchasePrice != null ? String(line.purchasePrice) : '',
    partnerPrice: line.partnerPrice != null ? String(line.partnerPrice) : '',
    couponPrice: line.couponPrice != null ? String(line.couponPrice) : '',
    fullSalePrice: line.fullSalePrice != null ? String(line.fullSalePrice) : '',
    wholesalePrice: line.wholesalePrice != null ? String(line.wholesalePrice) : '',
  }));
}

export function applyPurchaseLinePricing(product: Product, line: PurchaseInvoiceLine): Product {
  const purchasePrice = line.purchasePrice ?? grossFromNetUnit(line.unitCostNet, line.vatRate);
  let next: Product = {
    ...product,
    stock: product.stock + line.quantity,
    purchasePrice: Math.round(purchasePrice * 100) / 100,
  };
  if (line.pv != null) next = { ...next, pv: line.pv };
  if (line.partnerPrice != null) next = { ...next, partnerPrice: line.partnerPrice };
  if (line.couponPrice != null) next = { ...next, couponPrice: line.couponPrice };
  if (line.fullSalePrice != null) next = { ...next, fullSalePrice: line.fullSalePrice };
  if (line.wholesalePrice != null) {
    next = {
      ...next,
      wholesalePrices: {
        qty10: line.wholesalePrice,
        qty20: line.wholesalePrice,
        qty50: line.wholesalePrice,
        qty100: line.wholesalePrice,
      },
    };
  }
  return next;
}
