import type { Product } from '../types/product';
import { guessCategory } from '../utils/guessCategory';
import catalogJson from './greenleafCatalog.json';

export interface GreenleafCatalogItem {
  slug: string;
  sourceUrl: string;
  name: string;
  imageUrl: string | null;
  usdPrice: number;
  couponPrice: number;
  pv: number | null;
}

export const GREENLEAF_CATALOG = catalogJson as GreenleafCatalogItem[];

const GREENLEAF_ID_START = 37;

function buildPricing(item: GreenleafCatalogItem) {
  const pv = item.pv ?? 0.2;
  const partnerPrice =
    item.usdPrice > 0 ? Math.round(item.usdPrice * 35) : Math.max(50, Math.round(pv * 480));
  const fullSalePrice = Math.round(partnerPrice * 2);
  const ourPercent = Math.max(100, Math.round((fullSalePrice / partnerPrice - 1) * 100));
  const ourPriceWithVat = Math.round(fullSalePrice * 1.2 * 100) / 100;
  const partnerPriceWithVat = Math.round(partnerPrice * 1.2 * 100) / 100;
  const purchasePrice = Math.round(partnerPrice * 0.82 * 100) / 100;

  return {
    pv,
    purchasePrice,
    partnerPrice,
    fullSalePrice,
    ourPercent,
    ourPriceWithVat,
    partnerPriceWithVat,
  };
}

export const GREENLEAF_PRODUCTS: Omit<Product, 'stock'>[] = GREENLEAF_CATALOG.map((item, index) => {
  const pricing = buildPricing(item);
  return {
    id: GREENLEAF_ID_START + index,
    name: item.name,
    category: guessCategory(item.name),
    sourceUrl: item.sourceUrl,
    imageUrl: item.imageUrl ?? undefined,
    boxDimensions: '-',
    weightKg: 0,
    desi: 0,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    ...pricing,
  };
});

export const GREENLEAF_IMPORT_META = {
  sourcePage: 'https://greenleaf-global.com/shop/novyiy-tovar/',
  importedAt: '2026-09-08',
  count: GREENLEAF_CATALOG.length,
};
