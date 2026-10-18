import type { PriceType } from '../types/product';
import type { ProductSet } from '../types/productSet';
import { applyWholesaleVat, getWholesaleTierKey } from './wholesalePricing';

export function getProductSetSalePrice(set: ProductSet, priceType: PriceType, quantity = 1): number {
  if (priceType === 'sample') return 0;
  if (priceType === 'partner') return set.partnerPriceWithVat;
  if (priceType === 'wholesale') {
    const tier = getWholesaleTierKey(quantity);
    const net = tier && set.wholesalePrices ? set.wholesalePrices[tier] : null;
    return net != null ? applyWholesaleVat(net) : set.ourPriceWithVat;
  }
  return set.ourPriceWithVat;
}

export function sumSetComponentRetail(products: { id: number; ourPriceWithVat: number }[], items: ProductSet['items']): number {
  return items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + (product?.ourPriceWithVat ?? 0) * item.quantity;
  }, 0);
}
