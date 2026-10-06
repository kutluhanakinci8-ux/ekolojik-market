import type { WholesalePrices } from './product';

export interface ProductSetItem {
  productId: number;
  quantity: number;
}

export interface ProductSet {
  /** Benzersiz set kodu (örn. SET-001) */
  id: string;
  /** Stok / barkod numarası */
  stockCode: string;
  name: string;
  description?: string;
  items: ProductSetItem[];
  stock: number;
  ourPriceWithVat: number;
  partnerPriceWithVat: number;
  wholesalePrices?: WholesalePrices;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
