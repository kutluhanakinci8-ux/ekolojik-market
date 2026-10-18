import shopData from './greenleafShopProducts.json';

export interface GreenleafShopProduct {
  slug: string;
  sourceUrl: string;
  name: string;
  rawName: string;
  nameTr?: string;
  imageUrl: string | null;
  brand: string;
  boxQuantity: number | null;
  pv: number | null;
  description: string;
  descriptionTr?: string;
  features: string[];
  featuresTr?: string[];
}

export interface GreenleafShopCatalog {
  source: string;
  scrapedAt: string;
  count: number;
  products: GreenleafShopProduct[];
}

export const GREENLEAF_SHOP = shopData as GreenleafShopCatalog;

export const GREENLEAF_SHOP_PRODUCTS = GREENLEAF_SHOP.products;

export function getShopBrands(): string[] {
  const brands = new Set(GREENLEAF_SHOP_PRODUCTS.map((p) => p.brand));
  return [...brands].sort((a, b) => a.localeCompare(b, 'tr'));
}

function isBadTranslation(text: string): boolean {
  return /MYMEMORY\s+WARNING/i.test(text) || /TRANSLATED\.NET\/DOC\/USAGELIMITS/i.test(text);
}

function cleanTr(text: string | undefined, fallback: string): string {
  const tr = text?.trim();
  if (tr && !isBadTranslation(tr)) return tr;
  return fallback;
}

export function productDisplayName(product: GreenleafShopProduct): string {
  return cleanTr(product.nameTr, product.name);
}

export function productDisplayDescription(product: GreenleafShopProduct): string {
  return cleanTr(product.descriptionTr, product.description);
}

export function productDisplayFeatures(product: GreenleafShopProduct): string[] {
  const tr = (product.featuresTr ?? []).filter((f) => f && !isBadTranslation(f));
  if (tr.length) return tr;
  return product.features;
}
