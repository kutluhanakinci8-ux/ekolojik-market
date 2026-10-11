import type { AppSettings } from '../types/business';
import { CATEGORIES } from './categoryDefinitions';
import { getProductCategoryLabel } from '../utils/productCategories';

export type { Category } from './categoryDefinitions';
export { CATEGORIES, PRODUCT_CATEGORIES } from './categoryDefinitions';

export function getCategoryLabel(categoryId: string, settings?: AppSettings | null): string {
  if (settings) return getProductCategoryLabel(categoryId, settings);
  return CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}
