import type { CartItem, Product } from '../../types/product';
import type { CrmSettings } from '../../types/crm';

export function computeCartPv(cart: CartItem[], products: Product[]): number {
  let pv = 0;
  for (const item of cart) {
    if (item.productId == null || item.priceType === 'sample') continue;
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    pv += product.pv * item.quantity;
  }
  return pv;
}

export function computePointsToEarn(
  payableTotal: number,
  cartPv: number,
  settings: CrmSettings,
): number {
  const fromTry = Math.floor(payableTotal * settings.pointsPerTry);
  const fromPv = Math.floor(cartPv * settings.pointsPerPv);
  return Math.max(0, fromTry + fromPv);
}

export function loyaltyDiscountFromPoints(pointsToRedeem: number, settings: CrmSettings): number {
  if (pointsToRedeem <= 0) return 0;
  return Math.round(pointsToRedeem * settings.tryPerPointRedeem * 100) / 100;
}

export function maxRedeemablePoints(
  availablePoints: number,
  subtotalAfterOtherDiscounts: number,
  settings: CrmSettings,
): number {
  if (settings.tryPerPointRedeem <= 0) return 0;
  const maxByTotal = Math.floor(subtotalAfterOtherDiscounts / settings.tryPerPointRedeem);
  return Math.max(0, Math.min(availablePoints, maxByTotal));
}
