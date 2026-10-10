import { GREENLEAF_PRODUCTS } from '../data/greenleafCatalog';
import { CATEGORIES, getCategoryLabel, type Category } from '../data/categories';
import { SEED_PRODUCTS } from '../data/seedProducts';
import type { AppSettings } from '../types/business';
import type { Product } from '../types/product';
import type { ProductSet } from '../types/productSet';
import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { decodePosApiTokenClaims, loadPosApiToken } from '../services/posApiAuth';
import { isPosLiteProfile } from './tenantProductProfile';

/** main (Greenleaf) demo kataloğu — id 1..~170 aralığı */
const MAIN_DEMO_PRODUCT_IDS = new Set<number>([
  ...SEED_PRODUCTS.map((p) => p.id),
  ...GREENLEAF_PRODUCTS.map((p) => p.id),
]);

export const MAIN_GREENLEAF_CATALOG_MIN = 30;

function isLimaBrandedSettings(settings?: AppSettings | null): boolean {
  const name = (settings?.businessName ?? '').trim().toLowerCase();
  return name.includes('lima');
}

/** Perakende liste KDV hariç; fişte KDV dökümü ve kasada brüt tahsilat */
export function usesNetRetailWithVatBreakdown(settings?: AppSettings | null): boolean {
  return isPosLiteProfile(settings) || isLimaBrandedSettings(settings);
}

/** main tenant anahtarında yanlışlıkla Lima ayarı + Greenleaf kataloğu birleşmesini engelle */
export function isTenantCatalogIsolated(
  tenantId: string = loadTenantId(),
  settings?: AppSettings | null,
): boolean {
  if (tenantId && tenantId !== DEFAULT_TENANT_ID) return true;
  if (isPosLiteProfile(settings)) return true;
  if (isLimaBrandedSettings(settings)) return true;
  return false;
}

export function resolveEffectiveTenantId(): string {
  const claims = decodePosApiTokenClaims(loadPosApiToken());
  const fromToken = claims?.tenantId?.trim();
  if (fromToken) return fromToken;
  return loadTenantId();
}

/** İzole tenant’a yanlışlıkla yazılmış tam Greenleaf listesi mi? */
export function looksLikeMainGreenleafCatalog(products: Product[] | null | undefined): boolean {
  if (!products?.length || products.length < MAIN_GREENLEAF_CATALOG_MIN) return false;
  let seedHits = 0;
  for (const p of products) {
    const id = Number(p.id);
    if (MAIN_DEMO_PRODUCT_IDS.has(id)) seedHits += 1;
  }
  if (products.length >= 80 && seedHits / products.length >= 0.75) return true;
  if (products.length >= MAIN_GREENLEAF_CATALOG_MIN && seedHits === products.length) return true;
  return false;
}

/** İzole mağaza: yalnızca tenant ürünleri; Greenleaf seed asla gösterilmez / kaydedilmez. */
export function coerceTenantCatalogProducts(
  products: Product[] | null | undefined,
  isolated: boolean,
): Product[] {
  const list = products ?? [];
  if (!isolated) return list;
  if (!list.length) return [];
  if (looksLikeMainGreenleafCatalog(list)) return [];
  const filtered = list.filter((p) => !MAIN_DEMO_PRODUCT_IDS.has(Number(p.id)));
  return filtered.length > 0 ? filtered : list.filter((p) => Number(p.id) > 200);
}

/** Greenleaf setleri — tenant kataloğunda olmayan ürün ID’leri */
export function filterTenantProductSets(products: Product[], productSets: ProductSet[]): ProductSet[] {
  if (!productSets.length || !products.length) return [];
  const ids = new Set(products.map((p) => p.id));
  return productSets.filter((set) => {
    const items = set.items ?? [];
    if (!items.length) return false;
    return items.every((line) => ids.has(line.productId));
  });
}

export function categoriesForTenantSales(
  products: Product[],
  setCount: number,
  posLite: boolean,
): Category[] {
  if (!posLite) return CATEGORIES;

  const used = new Set(products.map((p) => p.category));
  const base = CATEGORIES.filter((cat) => {
    if (cat.id === 'all') return true;
    if (cat.id === 'setler') return setCount > 0;
    return used.has(cat.id);
  });

  for (const catId of used) {
    if (catId && !base.some((c) => c.id === catId)) {
      base.push({ id: catId, label: getCategoryLabel(catId), icon: '🏷️' });
    }
  }

  // Tek kategori varsa "Limo" vb. gereksiz sekme gösterme — yalnızca Tümü
  const productCats = base.filter((c) => c.id !== 'all' && c.id !== 'setler');
  if (productCats.length === 1 && setCount === 0) {
    return base.filter((c) => c.id === 'all');
  }

  return base.map((c) =>
    c.id === 'limo' ? { ...c, label: 'Ürünler', icon: '🧴' } : c,
  );
}
