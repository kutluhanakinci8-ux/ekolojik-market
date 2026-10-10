import type { PriceType, Product, SaleMode } from '../types/product';
import { isValidGreenleafNumber } from './customerValidation';
import { resolveRetailSaleUnitPrice } from './productPricing';
import { getWholesaleUnitPrice, applyWholesaleVat } from './wholesalePricing';

export const SALE_PRICE_LABELS: Record<PriceType, string> = {
  our: 'Perakende',
  partner: 'Partner',
  wholesale: 'Toptan',
  sample: 'Numune',
};

/** Toptan seçiliyse toptan; partner no varsa partner; aksi halde perakende */
export function resolveSalePriceType(greenleafNumber: string, saleMode: SaleMode = 'retail'): PriceType {
  if (saleMode === 'wholesale') return 'wholesale';
  if (isValidGreenleafNumber(greenleafNumber)) return 'partner';
  return 'our';
}

export function getProductSalePrice(product: Product, priceType: PriceType, quantity = 1): number {
  if (priceType === 'sample') return 0;
  if (priceType === 'partner') return product.partnerPriceWithVat;
  if (priceType === 'wholesale') {
    const net = getWholesaleUnitPrice(product, quantity);
    return net != null ? applyWholesaleVat(net) : resolveRetailSaleUnitPrice(product);
  }
  return resolveRetailSaleUnitPrice(product);
}

export function getCartUnitPrice(product: Product, quantity: number, priceType: PriceType): number {
  return getProductSalePrice(product, priceType, quantity);
}
