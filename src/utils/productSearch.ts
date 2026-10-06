import { CATEGORIES, getCategoryLabel } from '../data/categories';
import type { Product } from '../types/product';
import type { ProductSet } from '../types/productSet';

export type StockSearchFilter = 'all' | 'low' | 'out' | 'sample' | 'in_stock';

export interface SearchHint {
  type: 'category' | 'stock' | 'brand' | 'set' | 'token';
  label: string;
  value: string;
}

export interface ParsedProductSearch {
  raw: string;
  tokens: string[];
  categoryId: string | null;
  stockFilter: StockSearchFilter;
  showSets: boolean;
  hints: SearchHint[];
}

export interface ProductSearchResult {
  product: Product;
  score: number;
  matchedBrand?: string;
}

export interface ProductSearchOptions {
  lowStockThreshold: number;
}

const CATEGORY_ALIASES: Array<{ id: string; phrases: string[] }> = [
  { id: 'all', phrases: ['tumu', 'tümü', 'all', 'hepsi'] },
  { id: 'kisisel-bakim', phrases: ['kisisel bakim', 'kişisel bakım', 'kisisel', 'kişisel', 'bakim', 'bakım'] },
  { id: 'cilt-bakim', phrases: ['cilt bakimi', 'cilt bakımı', 'cilt', 'cilt bakim'] },
  { id: 'temizlik', phrases: ['temizlik', 'temiz', 'temizlik urun', 'temizlik ürün'] },
  { id: 'cocuk', phrases: ['cocuk', 'çocuk', 'bebek'] },
  { id: 'makyaj', phrases: ['makyaj', 'makeup'] },
  { id: 'kagit-mendil', phrases: ['kagit mendil', 'kağıt mendil', 'kagit', 'kağıt', 'mendil', 'pecete', 'peçete'] },
  { id: 'setler', phrases: ['setler', 'set', 'paket', 'bundle', 'kutu'] },
];

const STOCK_PHRASES: Array<{ filter: StockSearchFilter; phrases: string[] }> = [
  { filter: 'low', phrases: ['az stok', 'azstok', 'dusuk stok', 'düşük stok', 'azalan', 'kritik stok'] },
  { filter: 'out', phrases: ['tukenen', 'tükenen', 'tukendi', 'tükendi', 'stok yok', 'bitti', 'tukendi', 'biten'] },
  { filter: 'sample', phrases: ['numune', 'ornek', 'örnek', 'test urun', 'test ürün', 'ucretsiz', 'ücretsiz'] },
  { filter: 'in_stock', phrases: ['stokta', 'mevcut', 'var'] },
];

const MULTI_WORD_BRANDS = [
  'PINK POINT',
  'YIBEILE',
  'CARICH',
  'SEALUXE',
  'GREENLEAF',
  'KARDLI',
  'EVONY',
];

export function foldTurkish(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

export function tokenizeSearch(text: string): string[] {
  return foldTurkish(text)
    .split(/[\s,;/|+]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

export function extractBrand(name: string): string {
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();
  for (const brand of MULTI_WORD_BRANDS) {
    if (upper.startsWith(brand)) return brand;
  }
  const match = trimmed.match(/^([A-Za-zİıĞğÜüŞşÖöÇç0-9]+)/);
  return match?.[1] ?? trimmed.split(/\s+/)[0] ?? '';
}

const BRAND_CANONICAL: Record<string, string> = {
  ilife: 'iLiFE',
  greenleaf: 'GREENLEAF',
  carich: 'CARICH',
  yibeile: 'YIBEILE',
  sealuxe: 'SEALUXE',
  'pink point': 'PINK POINT',
  kardli: 'KARDLI',
  evony: 'EVONY',
};

export function normalizeBrandKey(brand: string): string {
  return foldTurkish(brand);
}

export function getBrandDisplayName(brand: string): string {
  const folded = foldTurkish(brand);
  return BRAND_CANONICAL[folded] ?? brand;
}

export function resolveProductBrand(name: string): { key: string; label: string } {
  const raw = extractBrand(name);
  const key = normalizeBrandKey(raw);
  return { key, label: getBrandDisplayName(raw) };
}

function collectKnownBrands(products: Product[]): string[] {
  const brands = new Set<string>();
  for (const product of products) {
    const brand = extractBrand(product.name);
    if (brand.length >= 2) brands.add(foldTurkish(brand));
  }
  return [...brands].sort((a, b) => b.length - a.length);
}

function includesPhrase(normalized: string, phrase: string): boolean {
  const folded = foldTurkish(phrase);
  if (!folded) return false;
  if (normalized === folded) return true;
  if (folded.length <= 4) {
    return normalized.split(/\s+/).includes(folded);
  }
  return normalized.includes(folded);
}

function stripMatchedPhrase(normalizedQuery: string, phrase: string): string {
  const foldedPhrase = foldTurkish(phrase);
  if (!foldedPhrase) return normalizedQuery;
  if (foldedPhrase.length <= 4) {
    return normalizedQuery
      .split(/\s+/)
      .filter((token) => token !== foldedPhrase)
      .join(' ')
      .trim();
  }
  return normalizedQuery.replace(foldedPhrase, ' ').replace(/\s+/g, ' ').trim();
}

export function parseProductSearch(query: string): ParsedProductSearch {
  const raw = query.trim();
  let normalized = foldTurkish(raw);
  const hints: SearchHint[] = [];
  let categoryId: string | null = null;
  let stockFilter: StockSearchFilter = 'all';
  let showSets = false;

  const sortedCategoryAliases = [...CATEGORY_ALIASES].sort(
    (a, b) => Math.max(...b.phrases.map((p) => p.length)) - Math.max(...a.phrases.map((p) => p.length)),
  );

  for (const entry of sortedCategoryAliases) {
    for (const phrase of entry.phrases) {
      const foldedPhrase = foldTurkish(phrase);
      if (!foldedPhrase) continue;
      if (includesPhrase(normalized, phrase)) {
        if (entry.id === 'setler') {
          showSets = true;
          hints.push({ type: 'set', label: 'Setler', value: 'setler' });
        } else if (entry.id !== 'all') {
          categoryId = entry.id;
          const label = CATEGORIES.find((cat) => cat.id === entry.id)?.label ?? entry.id;
          hints.push({ type: 'category', label, value: entry.id });
        }
        normalized = stripMatchedPhrase(normalized, phrase);
        break;
      }
    }
    if (categoryId || showSets) break;
  }

  for (const entry of STOCK_PHRASES) {
    for (const phrase of entry.phrases) {
      const foldedPhrase = foldTurkish(phrase);
      if (!foldedPhrase) continue;
      if (normalized.includes(foldedPhrase)) {
        stockFilter = entry.filter;
        hints.push({
          type: 'stock',
          label: entry.filter === 'low' ? 'Az Stok' : entry.filter === 'out' ? 'Tükenen' : entry.filter === 'sample' ? 'Numune' : 'Stokta',
          value: entry.filter,
        });
        normalized = stripMatchedPhrase(normalized, phrase);
        break;
      }
    }
  }

  const tokens = tokenizeSearch(normalized);
  return { raw, tokens, categoryId, stockFilter, showSets, hints };
}

function getProductStockStatus(product: Product, lowStockThreshold: number): 'ok' | 'low' | 'out' {
  if (product.stock <= 0) return 'out';
  if (product.stock <= lowStockThreshold) return 'low';
  return 'ok';
}

function buildSearchableText(product: Product, lowStockThreshold: number): string {
  const brand = extractBrand(product.name);
  const categoryLabel = getCategoryLabel(product.category);
  const status = getProductStockStatus(product, lowStockThreshold);
  const statusWords = status === 'low'
    ? 'az stok dusuk stok'
    : status === 'out'
      ? 'tukenen stok yok bitti'
      : 'stokta mevcut';
  const sampleWords = product.isSample ? 'numune ornek ucretsiz' : '';

  return foldTurkish([
    product.name,
    brand,
    categoryLabel,
    product.category.replace(/-/g, ' '),
    product.productCode ?? '',
    String(product.id),
    statusWords,
    sampleWords,
  ].join(' '));
}

function scoreProduct(product: Product, tokens: string[]): number {
  if (tokens.length === 0) return 1;

  const foldedName = foldTurkish(product.name);
  const foldedBrand = foldTurkish(extractBrand(product.name));
  const foldedCode = foldTurkish(product.productCode ?? '');
  const foldedCategory = foldTurkish(getCategoryLabel(product.category));
  const fullQuery = tokens.join(' ');

  let score = 0;

  if (foldedName === fullQuery) score += 120;
  if (foldedName.startsWith(fullQuery)) score += 90;
  if (foldedBrand === fullQuery) score += 85;
  if (foldedBrand.startsWith(fullQuery)) score += 70;
  if (foldedCode === fullQuery) score += 80;
  if (String(product.id) === fullQuery) score += 75;

  let matchedTokens = 0;
  for (const token of tokens) {
    if (token.length < 2 && !/^\d+$/.test(token)) continue;

    if (foldedName.includes(token)) {
      matchedTokens += 1;
      score += token.length >= 4 ? 24 : 16;
      if (foldedName.split(/\s+/).some((word) => word.startsWith(token))) score += 8;
      continue;
    }
    if (foldedBrand.includes(token) || token.includes(foldedBrand)) {
      matchedTokens += 1;
      score += 20;
      continue;
    }
    if (foldedCategory.includes(token)) {
      matchedTokens += 1;
      score += 14;
      continue;
    }
    if (foldedCode.includes(token)) {
      matchedTokens += 1;
      score += 18;
      continue;
    }
    if (String(product.id).includes(token)) {
      matchedTokens += 1;
      score += 12;
    }
  }

  if (matchedTokens < tokens.filter((token) => token.length >= 2 || /^\d+$/.test(token)).length) {
    return 0;
  }

  return score;
}

export function matchesStockFilter(
  product: Product,
  filter: StockSearchFilter,
  lowStockThreshold: number,
): boolean {
  const status = getProductStockStatus(product, lowStockThreshold);
  switch (filter) {
    case 'low':
      return status === 'low';
    case 'out':
      return status === 'out';
    case 'sample':
      return Boolean(product.isSample);
    case 'in_stock':
      return product.stock > 0;
    default:
      return true;
  }
}

export function searchProducts(
  products: Product[],
  query: string,
  options: ProductSearchOptions & {
    categoryId?: string;
    stockFilter?: StockSearchFilter;
  } = { lowStockThreshold: 10 },
): ProductSearchResult[] {
  const parsed = parseProductSearch(query);
  const effectiveCategory = options.categoryId && options.categoryId !== 'all'
    ? options.categoryId
    : parsed.categoryId;
  const effectiveStock = options.stockFilter && options.stockFilter !== 'all'
    ? options.stockFilter
    : parsed.stockFilter;

  const results: ProductSearchResult[] = [];

  for (const product of products) {
    if (effectiveCategory && effectiveCategory !== 'all' && product.category !== effectiveCategory) continue;
    if (!matchesStockFilter(product, effectiveStock, options.lowStockThreshold)) continue;

    if (parsed.tokens.length === 0 && !parsed.raw) {
      results.push({ product, score: 1, matchedBrand: extractBrand(product.name) });
      continue;
    }

    const searchable = buildSearchableText(product, options.lowStockThreshold);
    const fullQuery = foldTurkish(parsed.raw);
    const tokenMatch = parsed.tokens.length === 0
      || parsed.tokens.every((token) => searchable.includes(token));
    const phraseMatch = fullQuery.length > 0 && searchable.includes(fullQuery);

    if (!tokenMatch && !phraseMatch) continue;

    const score = Math.max(scoreProduct(product, parsed.tokens), phraseMatch ? 40 : 0);
    if (score <= 0 && !phraseMatch) continue;

    results.push({
      product,
      score,
      matchedBrand: extractBrand(product.name),
    });
  }

  return results.sort((a, b) => b.score - a.score || a.product.id - b.product.id);
}

export function searchProductSets(
  sets: ProductSet[],
  query: string,
  options: { onlyWhenRequested?: boolean } = {},
): ProductSet[] {
  const parsed = parseProductSearch(query);
  if (options.onlyWhenRequested && !parsed.showSets && !parsed.raw.toLowerCase().includes('set')) {
    return [];
  }

  const tokens = parsed.tokens.length > 0 ? parsed.tokens : tokenizeSearch(parsed.raw);

  return sets.filter((set) => {
    if (!set.isActive) return false;
    if (tokens.length === 0) return true;

    const searchable = foldTurkish([
      set.name,
      set.id,
      set.stockCode,
      set.description ?? '',
      'set setler paket',
    ].join(' '));

    const fullQuery = foldTurkish(parsed.raw);
    return tokens.every((token) => searchable.includes(token)) || (fullQuery && searchable.includes(fullQuery));
  });
}

export interface SearchSuggestion {
  id: string;
  label: string;
  hint: string;
  insertValue: string;
  type: 'brand' | 'category' | 'stock' | 'set' | 'product';
}

export function buildSearchSuggestions(
  products: Product[],
  query: string,
  lowStockThreshold: number,
  limit = 8,
): SearchSuggestion[] {
  const folded = foldTurkish(query.trim());
  if (folded.length < 2) return [];

  const suggestions: SearchSuggestion[] = [];
  const seen = new Set<string>();

  for (const category of CATEGORIES) {
    if (category.id === 'all') continue;
    const label = foldTurkish(category.label);
    if (label.includes(folded) || folded.includes(label.slice(0, 3))) {
      const key = `cat-${category.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          id: key,
          label: category.label,
          hint: 'Kategori',
          insertValue: category.label,
          type: 'category',
        });
      }
    }
  }

  const stockSuggestions = [
    { label: 'Az Stok', value: 'az stok' },
    { label: 'Tükenen', value: 'tükenen' },
    { label: 'Numune', value: 'numune' },
    { label: 'Setler', value: 'setler' },
  ];
  for (const item of stockSuggestions) {
    if (foldTurkish(item.label).includes(folded) || foldTurkish(item.value).includes(folded)) {
      const key = `stock-${item.value}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({
          id: key,
          label: item.label,
          hint: item.label === 'Setler' ? 'Set' : 'Stok filtresi',
          insertValue: item.value,
          type: item.label === 'Setler' ? 'set' : 'stock',
        });
      }
    }
  }

  const brands = collectKnownBrands(products);
  for (const brand of brands) {
    if (brand.includes(folded) || brand.startsWith(folded)) {
      const key = `brand-${brand}`;
      if (!seen.has(key)) {
        seen.add(key);
        const original = products.find((product) => foldTurkish(extractBrand(product.name)) === brand);
        suggestions.push({
          id: key,
          label: original ? extractBrand(original.name) : brand,
          hint: 'Marka',
          insertValue: original ? extractBrand(original.name) : brand,
          type: 'brand',
        });
      }
    }
  }

  const productHits = searchProducts(products, query, { lowStockThreshold }).slice(0, 5);
  for (const hit of productHits) {
    const key = `product-${hit.product.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      suggestions.push({
        id: key,
        label: hit.product.name,
        hint: hit.matchedBrand ? `${hit.matchedBrand} · No ${hit.product.id}` : `No ${hit.product.id}`,
        insertValue: hit.product.name,
        type: 'product',
      });
    }
  }

  return suggestions.slice(0, limit);
}

export function getActiveSearchHints(
  query: string,
  categoryId: string,
  stockFilter: StockSearchFilter,
): SearchHint[] {
  const parsed = parseProductSearch(query);
  const hints = [...parsed.hints];

  if (categoryId !== 'all' && !hints.some((hint) => hint.type === 'category')) {
    const label = CATEGORIES.find((cat) => cat.id === categoryId)?.label;
    if (label) hints.unshift({ type: 'category', label, value: categoryId });
  }

  if (stockFilter !== 'all' && !hints.some((hint) => hint.type === 'stock')) {
    const label = stockFilter === 'low' ? 'Az Stok' : stockFilter === 'out' ? 'Tükenen' : stockFilter === 'sample' ? 'Numune' : 'Stokta';
    hints.unshift({ type: 'stock', label, value: stockFilter });
  }

  if (parsed.tokens.length > 0) {
    for (const token of parsed.tokens) {
      if (token.length >= 2) {
        hints.push({ type: 'token', label: token, value: token });
      }
    }
  }

  return hints;
}
