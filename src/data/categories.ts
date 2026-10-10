export interface Category {
  id: string;
  label: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { id: 'all', label: 'Tümü', icon: '🏪' },
  { id: 'limo', label: 'Limo', icon: '🍋' },
  { id: 'kisisel-bakim', label: 'Kişisel Bakım', icon: '🧴' },
  { id: 'cilt-bakim', label: 'Cilt Bakımı', icon: '✨' },
  { id: 'temizlik', label: 'Temizlik', icon: '🫧' },
  { id: 'cocuk', label: 'Çocuk', icon: '🧒' },
  { id: 'makyaj', label: 'Makyaj', icon: '💄' },
  { id: 'kagit-mendil', label: 'Kağıt & Mendil', icon: '🧻' },
  { id: 'setler', label: 'Setler', icon: '🎁' },
];

export const PRODUCT_CATEGORIES: Record<number, string> = {
  1: 'kisisel-bakim',
  2: 'kisisel-bakim',
  3: 'kisisel-bakim',
  4: 'cocuk',
  5: 'cocuk',
  6: 'kisisel-bakim',
  7: 'kisisel-bakim',
  8: 'kagit-mendil',
  9: 'kagit-mendil',
  10: 'cilt-bakim',
  11: 'temizlik',
  12: 'temizlik',
  13: 'kisisel-bakim',
  14: 'cilt-bakim',
  15: 'cilt-bakim',
  16: 'cilt-bakim',
  17: 'kisisel-bakim',
  18: 'temizlik',
  19: 'kisisel-bakim',
  20: 'cilt-bakim',
  21: 'temizlik',
  22: 'temizlik',
  23: 'temizlik',
  24: 'kisisel-bakim',
  25: 'cilt-bakim',
  26: 'cilt-bakim',
  27: 'cilt-bakim',
  28: 'kisisel-bakim',
  29: 'makyaj',
  30: 'cilt-bakim',
  31: 'temizlik',
  32: 'cilt-bakim',
  33: 'cilt-bakim',
  34: 'cocuk',
  35: 'kisisel-bakim',
  36: 'kisisel-bakim',
  137: 'cilt-bakimi',
};

export function getCategoryLabel(categoryId: string): string {
  return CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;
}
