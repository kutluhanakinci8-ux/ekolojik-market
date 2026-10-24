import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeProductPricingFields } from '../../src/utils/mergeStoreSnapshots.ts';

test('mergeProductPricingFields prefers newer timestamp', () => {
  const local = {
    id: 1,
    partnerPrice: 150,
    pricingUpdatedAt: '2026-10-24T10:00:00.000Z',
  };
  const remote = {
    id: 1,
    partnerPrice: 127.6,
    pricingUpdatedAt: '2026-10-24T09:00:00.000Z',
  };
  const merged = mergeProductPricingFields(local, remote);
  assert.equal(merged.partnerPrice, 150);
});

test('mergeProductPricingFields prefers local on tie (stale PUT guard)', () => {
  const local = {
    id: 1,
    partnerPrice: 150,
    couponPrice: 150,
    pricingUpdatedAt: '2026-10-24T10:00:00.000Z',
  };
  const remote = {
    id: 1,
    partnerPrice: 127.6,
    couponPrice: 127.6,
    pricingUpdatedAt: '2026-10-24T10:00:00.000Z',
  };
  const merged = mergeProductPricingFields(local, remote);
  assert.equal(merged.partnerPrice, 150);
});
