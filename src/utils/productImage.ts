import type { Product } from '../types/product';
import { getCatalogImagePath } from '../data/productImages';

const BRAND_COLORS: Record<string, [number, number]> = {
  ilife: [200, 55],
  carich: [160, 50],
  yibeile: [30, 55],
  sealuxe: [280, 45],
  pink: [330, 50],
  greenleaf: [120, 45],
};

function getBrandHue(name: string): number {
  const lower = name.toLowerCase();
  for (const [brand, [hue]] of Object.entries(BRAND_COLORS)) {
    if (lower.includes(brand)) return hue;
  }
  return ((name.charCodeAt(0) || 65) * 17) % 360;
}

function getInitials(name: string): string {
  const words = name.replace(/[()[\],]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (name[0] || '?').toUpperCase();
}

function getEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('şampuan') || n.includes('saç')) return '🧴';
  if (n.includes('diş')) return '🪥';
  if (n.includes('sabun') || n.includes('duş')) return '🧼';
  if (n.includes('krem') || n.includes('losyon') || n.includes('jeli')) return '🧴';
  if (n.includes('deterjan') || n.includes('çamaşır') || n.includes('bulaşık')) return '🫧';
  if (n.includes('mendil')) return '🧻';
  if (n.includes('maske') || n.includes('balm')) return '✨';
  if (n.includes('makyaj')) return '💄';
  return '📦';
}

export function getPlaceholderImage(product: Product): string {
  const hue = getBrandHue(product.name);
  const hue2 = (hue + 35) % 360;
  const initials = getInitials(product.name);
  const emoji = getEmoji(product.name);
  const shortName = product.name.length > 28 ? product.name.slice(0, 26) + '…' : product.name;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="hsl(${hue},48%,32%)"/>
        <stop offset="100%" stop-color="hsl(${hue2},42%,22%)"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" fill="url(#bg)"/>
    <circle cx="200" cy="145" r="72" fill="rgba(255,255,255,0.12)"/>
    <text x="200" y="165" text-anchor="middle" font-size="64">${emoji}</text>
    <text x="200" y="250" text-anchor="middle" fill="white" font-size="42" font-family="system-ui,sans-serif" font-weight="700" opacity="0.95">${initials}</text>
    <text x="200" y="310" text-anchor="middle" fill="rgba(255,255,255,0.75)" font-size="16" font-family="system-ui,sans-serif">${shortName.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
    <text x="200" y="370" text-anchor="middle" fill="rgba(255,255,255,0.45)" font-size="14" font-family="system-ui,sans-serif">#${product.id}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getProductImageUrl(product: Product): string {
  const catalogId = product.catalogImageId ?? product.id;
  const catalogPath = getCatalogImagePath(catalogId);
  return product.imageUrl || catalogPath || getPlaceholderImage(product);
}

export function isCustomImage(product: Product): boolean {
  if (product.imageUrl?.startsWith('data:')) return true;
  if (product.imageUrl && !product.imageUrl.startsWith('/product-images/')) return true;
  return false;
}
