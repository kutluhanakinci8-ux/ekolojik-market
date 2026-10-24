#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mergeIncomingStoreWithExisting } from '../../server/storeSnapshotMerge.mjs';

const saleId = 'S-test-payment-merge';
const base = {
  id: saleId,
  createdAt: '2026-10-16T12:00:00.000Z',
  total: 100,
  items: [],
  paymentMethod: 'transfer',
};

const existing = {
  updatedAt: '2026-10-16T13:00:00.000Z',
  sales: [{
    ...base,
    paymentMethod: 'cash',
    paymentCorrectedAt: '2026-10-16T14:00:00.000Z',
    paymentCorrectionNote: 'Muhasebe satış düzenleme',
  }],
};

const staleIncoming = {
  updatedAt: '2026-10-16T15:00:00.000Z',
  sales: [{ ...base, paymentMethod: 'transfer' }],
};

const merged = mergeIncomingStoreWithExisting(staleIncoming, existing);
const row = merged.sales.find((s) => s.id === saleId);
assert.equal(row.paymentMethod, 'cash', 'newer paymentCorrectedAt on disk must win over stale PUT');
assert.equal(row.paymentCorrectionNote, 'Muhasebe satış düzenleme');

const newerIncoming = {
  updatedAt: '2026-10-16T16:00:00.000Z',
  sales: [{
    ...base,
    paymentMethod: 'card',
    paymentCorrectedAt: '2026-10-16T17:00:00.000Z',
    paymentCorrectionNote: 'Muhasebe satış düzenleme',
  }],
};

const merged2 = mergeIncomingStoreWithExisting(newerIncoming, existing);
const row2 = merged2.sales.find((s) => s.id === saleId);
assert.equal(row2.paymentMethod, 'card', 'newer payment correction from client must persist');

const existingPricing = {
  updatedAt: '2026-10-24T10:00:00.000Z',
  products: [{
    id: 19,
    partnerPrice: 150,
    couponPrice: 150,
    pricingUpdatedAt: '2026-10-24T10:05:00.000Z',
  }],
};
const stalePricingPut = {
  updatedAt: '2026-10-24T10:10:00.000Z',
  products: [{
    id: 19,
    partnerPrice: 127.6,
    couponPrice: 127.6,
    pricingUpdatedAt: '2026-10-24T10:05:00.000Z',
  }],
};
const mergedPricing = mergeIncomingStoreWithExisting(stalePricingPut, existingPricing);
const p19 = mergedPricing.products.find((p) => Number(p.id) === 19);
assert.equal(p19.partnerPrice, 150, 'equal pricingUpdatedAt must keep disk (PATCH) prices over stale PUT');

console.log('store-snapshot-merge-smoke: ok');
