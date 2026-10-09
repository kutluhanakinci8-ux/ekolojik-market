export interface Product {
  id: number;
  /** Greenleaf ürün kodu (örn. DAA062) */
  productCode?: string;
  /** EAN / barkod (okuyucu ile okutulacak değer; boşsa productCode veya stok no kullanılır) */
  barcode?: string;
  name: string;
  category: string;
  pv: number;
  purchasePrice: number;
  partnerPrice: number;
  couponPrice?: number;
  fullSalePrice: number;
  ourPercent: number;
  ourPriceWithVat: number;
  partnerPriceWithVat: number;
  boxDimensions: string;
  weightKg: number;
  desi: number;
  cargoPerUnit: number;
  suratTotal: number;
  arasTotal: number;
  yurticiTotal: number;
  stock: number;
  /** Numune / test ürünü — satış stokundan ayrı takip */
  isSample?: boolean;
  /** Numune stok adedi (satılabilir stoktan bağımsız) */
  sampleStock?: number;
  imageUrl?: string;
  /** Greenleaf katalog görseli (farklı tenant ürün id’si için kaynak id, örn. Lima #1001 → main #1) */
  catalogImageId?: number;
  sourceUrl?: string;
  /** Adet kademeli toptan birim fiyatları (KDV dahil) */
  wholesalePrices?: WholesalePrices;
}

export interface WholesalePrices {
  qty10: number;
  qty20: number;
  qty50: number;
  qty100: number;
}

export type PriceType = 'our' | 'partner' | 'wholesale' | 'sample';

export type SaleMode = 'retail' | 'wholesale';

export interface CartItem {
  productId?: number;
  setId?: string;
  quantity: number;
  priceType: PriceType;
  unitPrice: number;
}

export type SaleStatus = 'completed' | 'partially_returned' | 'fully_returned';

export interface Sale {
  id: string;
  items: CartItem[];
  total: number;
  /** Ücretli satış, ücretsiz numune veya karışık */
  saleKind?: 'sale' | 'sample' | 'mixed';
  paymentMethod: 'cash' | 'card' | 'transfer' | 'credit' | 'split';
  /** Bölünmüş ödeme (nakit + kart vb.) */
  paymentSplits?: Array<{ method: 'cash' | 'card' | 'transfer'; amount: number }>;
  /** Nakit ödeme: müşterinin verdiği tutar */
  cashTendered?: number;
  /** Para üstü */
  changeGiven?: number;
  /** Veresiye satış vadesi YYYY-MM-DD */
  dueDate?: string;
  customerId?: string;
  /** Satış anındaki müşteri adı (kayıt yoksa bile fişte görünür) */
  customerName?: string;
  greenleafNumber?: string;
  cashierId?: string;
  cashierName?: string;
  status?: SaleStatus;
  /** YYYY-MM-DD — operasyonel iş günü (yoksa createdAt kullanılır) */
  businessDate?: string;
  createdAt: string;
  /** CRM indirimleri (kampanya + kupon + puan) */
  crmDiscountTotal?: number;
  couponCode?: string;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
  campaignId?: string;
}

export type StockMovementType =
  | 'in'
  | 'out'
  | 'adjust'
  | 'sale'
  | 'sample'
  | 'set_assembly'
  | 'set_sale'
  | 'return'
  | 'set_return';

export interface StockMovement {
  id: string;
  productId?: number;
  setId?: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  note?: string;
  saleId?: string;
  returnId?: string;
  createdAt: string;
}
