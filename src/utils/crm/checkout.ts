import type { Customer } from '../../types/business';
import type { CartItem, Product } from '../../types/product';
import type { CustomerLedgerEntry } from '../../types/accounting';
import type { CrmCheckoutPreview, CrmPersistedData, CrmSettings } from '../../types/crm';
import type { Sale } from '../../types/product';
import type { SaleReturn } from '../../types/saleReturn';
import { validateCreditSale } from './credit';
import {
  computeCouponDiscount,
  findActiveCampaignsForCustomer,
  findCouponByCode,
  pickBestCampaignDiscount,
  validateCoupon,
} from './coupons';
import {
  computeCartPv,
  computePointsToEarn,
  loyaltyDiscountFromPoints,
  maxRedeemablePoints,
} from './loyalty';
import { getCustomerCrmProfile } from './profile';
import { listMatchingSegmentIds } from './segments';

export function buildCheckoutPreview(
  subtotal: number,
  cart: CartItem[],
  products: Product[],
  customer: Customer | undefined,
  customers: Customer[],
  sales: Sale[],
  saleReturns: SaleReturn[],
  ledger: CustomerLedgerEntry[],
  crmData: CrmPersistedData,
  settings: CrmSettings,
  couponCode: string,
  pointsToRedeem: number,
  paymentMethod: Sale['paymentMethod'],
): CrmCheckoutPreview {
  const preview: CrmCheckoutPreview = {
    subtotal,
    campaignDiscount: 0,
    couponDiscount: 0,
    loyaltyDiscount: 0,
    total: subtotal,
    pointsToEarn: 0,
    pointsRedeemed: 0,
  };

  if (subtotal <= 0) return preview;

  if (customer) {
    const crm = getCustomerCrmProfile(customer, settings);
    if (crm.status === 'blacklist') {
      preview.blockedReason = 'Müşteri kara listede.';
      return preview;
    }
    if (crm.status === 'cash_only' && paymentMethod === 'credit') {
      preview.blockedReason = 'Yalnızca nakit/kart müşterisi — veresiye yok.';
      return preview;
    }

    const segmentIds = listMatchingSegmentIds(
      crmData.segments,
      customer,
      sales,
      saleReturns,
      customers,
      ledger,
      settings,
    );
    const campaigns = findActiveCampaignsForCustomer(
      crmData.campaigns,
      crm.tagIds,
      segmentIds,
    );
    const { discount: campaignDiscount, campaign } = pickBestCampaignDiscount(campaigns, subtotal);
    preview.campaignDiscount = campaignDiscount;
    preview.campaignId = campaign?.id;

    if (paymentMethod === 'credit') {
      const afterDiscounts = subtotal - campaignDiscount;
      preview.creditError = validateCreditSale(customer, afterDiscounts, ledger, settings) ?? undefined;
    }
  }

  let afterCampaign = subtotal - preview.campaignDiscount;

  const coupon = findCouponByCode(crmData, couponCode);
  if (coupon) {
    const err = validateCoupon(coupon, afterCampaign, customer?.id);
    if (err) preview.couponError = err;
    else {
      preview.couponDiscount = computeCouponDiscount(coupon, afterCampaign);
      preview.couponId = coupon.id;
    }
  } else if (couponCode.trim()) {
    preview.couponError = 'Kupon bulunamadı.';
  }

  afterCampaign -= preview.couponDiscount;

  if (customer) {
    const crm = getCustomerCrmProfile(customer, settings);
    const maxPoints = maxRedeemablePoints(crm.loyaltyPoints, afterCampaign, settings);
    const redeem = Math.min(Math.max(0, pointsToRedeem), maxPoints);
    preview.pointsRedeemed = redeem;
    preview.loyaltyDiscount = loyaltyDiscountFromPoints(redeem, settings);
  }

  preview.total = Math.max(0, Math.round((afterCampaign - preview.loyaltyDiscount) * 100) / 100);
  const pv = computeCartPv(cart, products);
  preview.pointsToEarn = computePointsToEarn(preview.total, pv, settings);

  return preview;
}
