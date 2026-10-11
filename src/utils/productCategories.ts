import { CATEGORIES, type Category } from '../data/categories';
import type { AppSettings, ProductCategoryDef } from '../types/business';
import type { Product } from '../types/product';

export const PRODUCT_CATEGORY_FILTER_ALL = 'all';
export const PRODUCT_CATEGORY_SETS = 'setler';

const RESERVED_CATEGORY_IDS = new Set([PRODUCT_CATEGORY_FILTER_ALL, PRODUCT_CATEGORY_SETS]);

/** Satışa atanabilir varsayılan kategoriler (Tümü / Setler hariç) */
export const BUILTIN_PRODUCT_CATEGORY_DEFS: ProductCategoryDef[] = CATEGORIES.filter(
  (c) => !RESERVED_CATEGORY_IDS.has(c.id),
).map((c) => ({ id: c.id, label: c.label, icon: c.icon }));

export function normalizeProductCategoryCatalog(
  raw?: ProductCategoryDef[] | null,
): ProductCategoryDef[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const seen = new Set<string>();
  const out: ProductCategoryDef[] = [];
  for (const item of raw) {
    if (!item || typeof item.id !== 'string' || typeof item.label !== 'string') continue;
    const id = item.id.trim();
    if (!id || RESERVED_CATEGORY_IDS.has(id) || seen.has(id)) continue;
    const label = item.label.trim();
    if (!label) continue;
    const icon = (item.icon ?? '🏷️').trim() || '🏷️';
    seen.add(id);
    out.push({ id, label, icon });
  }
  return out;
}

export function resolveProductCategoryCatalog(settings?: AppSettings | null): ProductCategoryDef[] {
  const custom = normalizeProductCategoryCatalog(settings?.productCategoryCatalog);
  if (custom.length > 0) return custom;
  return BUILTIN_PRODUCT_CATEGORY_DEFS.map((c) => ({ ...c }));
}

export function getProductCategoryLabel(categoryId: string, settings?: AppSettings | null): string {
  if (categoryId === PRODUCT_CATEGORY_FILTER_ALL) return 'Tümü';
  if (categoryId === PRODUCT_CATEGORY_SETS) return 'Setler';
  const catalog = resolveProductCategoryCatalog(settings);
  const hit = catalog.find((c) => c.id === categoryId);
  if (hit) return hit.label;
  const builtin = CATEGORIES.find((c) => c.id === categoryId);
  return builtin?.label ?? categoryId;
}

export function productCategoryToChip(def: ProductCategoryDef): Category {
  return { id: def.id, label: def.label, icon: def.icon };
}

export function categoriesForStockFilters(
  products: Product[],
  settings?: AppSettings | null,
  posLite?: boolean,
): Category[] {
  const catalog = resolveProductCategoryCatalog(settings);
  const chips: Category[] = [{ id: PRODUCT_CATEGORY_FILTER_ALL, label: 'Tümü', icon: '🏪' }];

  if (posLite) {
    for (const def of catalog) {
      chips.push(productCategoryToChip(def));
    }
    return chips;
  }

  const used = new Set(products.map((p) => p.category));
  for (const def of catalog) {
    if (used.has(def.id)) chips.push(productCategoryToChip(def));
  }
  for (const catId of used) {
    if (!catId || chips.some((c) => c.id === catId)) continue;
    chips.push({
      id: catId,
      label: getProductCategoryLabel(catId, settings),
      icon: '🏷️',
    });
  }
  return chips;
}

export function listProductCategorySelectOptions(
  settings?: AppSettings | null,
): ProductCategoryDef[] {
  return resolveProductCategoryCatalog(settings);
}

export function slugifyProductCategoryId(label: string): string {
  const base = label
    .trim()
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || `kat-${Date.now()}`;
}

export function createProductCategoryId(label: string, existingIds: Set<string>): string {
  let id = slugifyProductCategoryId(label);
  if (!existingIds.has(id)) return id;
  let n = 2;
  while (existingIds.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

export function validateProductCategoryLabel(
  label: string,
  catalog: ProductCategoryDef[],
  editingId?: string,
): string | null {
  const trimmed = label.trim();
  if (!trimmed) return 'Kategori adı zorunludur.';
  if (trimmed.length < 2) return 'Kategori adı en az 2 karakter olmalıdır.';
  const lower = trimmed.toLocaleLowerCase('tr');
  const duplicate = catalog.some(
    (c) => c.id !== editingId && c.label.toLocaleLowerCase('tr') === lower,
  );
  if (duplicate) return 'Bu isimde bir kategori zaten var.';
  return null;
}

export function countProductsByCategory(products: Product[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of products) {
    counts[p.category] = (counts[p.category] ?? 0) + 1;
  }
  return counts;
}
