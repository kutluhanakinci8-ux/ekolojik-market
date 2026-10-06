import type { ProductSet } from '../types/productSet';

const now = '2026-09-09T00:00:00.000Z';

/** Örnek setler — yönetici düzenleyebilir */
export const DEFAULT_PRODUCT_SETS: ProductSet[] = [
  {
    id: 'SET-001',
    stockCode: 'STK-SET-001',
    name: 'Ekolojik Günlük Bakım Seti',
    description: 'Ev sabunu + diş fırçası + el kremi',
    items: [
      { productId: 1, quantity: 1 },
      { productId: 2, quantity: 1 },
      { productId: 14, quantity: 1 },
    ],
    stock: 25,
    ourPriceWithVat: 499,
    partnerPriceWithVat: 299,
    wholesalePrices: { qty10: 449, qty20: 429, qty50: 409, qty100: 389 },
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'SET-002',
    stockCode: 'STK-SET-002',
    name: 'Çocuk Bakım Seti',
    description: 'Çocuk şampuanı + diş macunu',
    items: [
      { productId: 4, quantity: 1 },
      { productId: 5, quantity: 1 },
    ],
    stock: 18,
    ourPriceWithVat: 849,
    partnerPriceWithVat: 499,
    wholesalePrices: { qty10: 769, qty20: 739, qty50: 709, qty100: 679 },
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
];
