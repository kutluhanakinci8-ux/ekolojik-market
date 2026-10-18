import type { CrmCoupon, CrmCampaign, CrmPersistedData } from '../../types/crm';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function findCouponByCode(data: CrmPersistedData, code: string): CrmCoupon | undefined {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return undefined;
  return data.coupons.find((c) => c.code.toUpperCase() === normalized && c.active);
}

export function validateCoupon(
  coupon: CrmCoupon,
  subtotal: number,
  customerId?: string,
  now = new Date(),
): string | null {
  if (!coupon.active) return 'Kupon aktif değil.';
  if (coupon.usedCount >= coupon.maxUses) return 'Kupon kullanım limiti dolmuş.';
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) return 'Kupon süresi dolmuş.';
  if (coupon.customerId && coupon.customerId !== customerId) return 'Kupon bu müşteriye özel.';
  if (coupon.minCartTotal != null && subtotal < coupon.minCartTotal) {
    return `Minimum sepet: ${coupon.minCartTotal.toFixed(2)} ₺`;
  }
  return null;
}

export function computeCouponDiscount(coupon: CrmCoupon, subtotal: number): number {
  if (subtotal <= 0) return 0;
  if (coupon.discountType === 'fixed') {
    return roundMoney(Math.min(subtotal, coupon.discountValue));
  }
  return roundMoney(subtotal * (coupon.discountValue / 100));
}

export function findActiveCampaignsForCustomer(
  campaigns: CrmCampaign[],
  customerTagIds: string[],
  segmentIds: string[],
  now = new Date(),
): CrmCampaign[] {
  return campaigns.filter((c) => {
    if (!c.active) return false;
    if (new Date(c.startsAt) > now || new Date(c.endsAt) < now) return false;
    if (c.segmentId && !segmentIds.includes(c.segmentId)) return false;
    if (c.tagIds.length > 0 && !c.tagIds.some((tag) => customerTagIds.includes(tag))) return false;
    return true;
  });
}

export function computeCampaignDiscount(campaign: CrmCampaign, subtotal: number): number {
  if (subtotal <= 0) return 0;
  if (campaign.minCartTotal != null && subtotal < campaign.minCartTotal) return 0;
  if (campaign.discountType === 'fixed') {
    return roundMoney(Math.min(subtotal, campaign.discountValue));
  }
  if (campaign.discountType === 'percent' || campaign.discountType === 'min_cart_percent') {
    return roundMoney(subtotal * (campaign.discountValue / 100));
  }
  return 0;
}

export function pickBestCampaignDiscount(campaigns: CrmCampaign[], subtotal: number): {
  campaign?: CrmCampaign;
  discount: number;
} {
  let best = 0;
  let bestCampaign: CrmCampaign | undefined;
  for (const campaign of campaigns) {
    const discount = computeCampaignDiscount(campaign, subtotal);
    if (discount > best) {
      best = discount;
      bestCampaign = campaign;
    }
  }
  return { campaign: bestCampaign, discount: best };
}
