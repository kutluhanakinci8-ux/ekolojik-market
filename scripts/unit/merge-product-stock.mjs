import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeProductStockLevel } from '../../src/utils/mergeStoreSnapshots.ts';

test('mergeProductStockLevel prefers newer local movement', () => {
  const localP = { id: 1, stock: 25 };
  const remoteP = { id: 1, stock: 19 };
  const localMovements = [{
    id: 'm1',
    productId: 1,
    createdAt: '2026-10-22T20:00:00.000Z',
    newStock: 25,
    type: 'in',
    quantity: 6,
    previousStock: 19,
    productName: 'X',
  }];
  const remoteMovements = [{
    id: 'm0',
    productId: 1,
    createdAt: '2026-10-22T10:00:00.000Z',
    newStock: 19,
    type: 'in',
    quantity: 1,
    previousStock: 18,
    productName: 'X',
  }];
  assert.equal(
    mergeProductStockLevel(localP, remoteP, localMovements, remoteMovements, false),
    25,
  );
});

test('mergeProductStockLevel uses preferLocalSnapshot when no movements', () => {
  const localP = { id: 2, stock: 30 };
  const remoteP = { id: 2, stock: 19 };
  assert.equal(
    mergeProductStockLevel(localP, remoteP, [], [], true),
    30,
  );
  assert.equal(
    mergeProductStockLevel(localP, remoteP, [], [], false),
    19,
  );
});
