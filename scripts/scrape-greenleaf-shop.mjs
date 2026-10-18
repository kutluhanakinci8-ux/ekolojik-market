#!/usr/bin/env node
/**
 * Greenleaf shop kataloğu — https://greenleaf-global.com/shop/
 * Fiyat olmadan: ad, görsel, marka, kutu adedi, PV, özellikler/açıklama
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = 'https://greenleaf-global.com/shop/';
const OUT_FILE = join(__dirname, '../src/data/greenleafShopProducts.json');

const BRANDS = [
  'SEALUXE', 'CARICH', 'iLiFE', 'ILIFE', 'YIBEILE', 'Yibeile', 'MARVISIA', 'KARDLI', 'Kardli',
  'MAIWEIS', 'GREENLEAF', 'Greenleaf', 'Green Leaf', 'BOCARE', 'BERCLEAN', 'EASYLOVE', 'Nilrich',
  'Newitz', 'PINK POINT', 'Pink Point', 'Moon Flore', 'Su Ting', 'YUIZKUE', 'Kailanduo', 'NMN',
  'Home Deli', 'Sinos',
];

function extractBrand(name) {
  const upper = name.toUpperCase();
  for (const brand of BRANDS) {
    if (upper.includes(brand.toUpperCase())) return brand.replace('ILIFE', 'iLiFE');
  }
  return 'Greenleaf';
}

function extractBoxQuantity(name) {
  const m = name.match(/(?:Кол-во|кол-во|Кол-во)\s*(?:в|коробке|коробе)\s*(\d+)\s*шт/i)
    || name.match(/(\d+)\s*шт\.?\s*(?:в|\/)\s*короб/i)
    || name.match(/\(Кол-во[^)]*?(\d+)\s*шт/i);
  return m ? Number(m[1]) : null;
}

function cleanName(name) {
  return name
    .replace(/^\(Кол-во[^)]+\)\s*/i, '')
    .replace(/^Кол-во[^)]+\)\s*/i, '')
    .replace(/^\(Кол-во коробке[^)]+\)\s*/i, '')
    .trim();
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseFeatures(text) {
  if (!text) return [];
  const parts = text.split(/Свойства\s*:/i);
  const body = parts.length > 1 ? parts[1] : parts[0];
  const lines = body
    .split(/[•\n\r]+/)
    .map((l) => l.replace(/^[-–—]\s*/, '').trim())
    .filter((l) => l.length > 4 && !/\$|USD|куп\.|price/i.test(l));
  if (lines.length <= 1 && body.length > 20) {
    return [body.slice(0, 300)];
  }
  return lines.slice(0, 8);
}

function parseListing(html) {
  const titles = [...html.matchAll(/<a class="card-product__title" href="([^"]+)">([^<]+)<\/a>/g)];
  const imgs = new Map(
    [...html.matchAll(/<a class="card-product__img" href="([^"]+)"><img[^>]+src="([^"]+)"/g)].map(
      ([, url, src]) => [url, src],
    ),
  );
  const blocks = [
    ...html.matchAll(/<div class="card-product">(.*?)(?=<div class="col-lg-4|<div class="pagination)/gs),
  ].map((m) => m[1]);

  return titles.map((match, index) => {
    const url = match[1];
    const rawName = match[2];
    const block = blocks[index] ?? '';
    let pv = null;
    for (const sticker of block.matchAll(/card-product__sticker[^>]*>([^<]+)</g)) {
      const match = sticker[1].match(/(\d+[.,]?\d*)\s*PV/i);
      if (match) pv = Number.parseFloat(match[1].replace(',', '.'));
      if (sticker[1].trim() === 'PV' && pv === null) pv = 0;
    }
    let imageUrl = imgs.get(url) ?? null;
    if (imageUrl?.startsWith('/')) imageUrl = `https://greenleaf-global.com${imageUrl}`;
    const fullUrl = url.startsWith('http') ? url : `https://greenleaf-global.com${url}`;

    return {
      slug: url.replace(/\/$/, '').split('/').pop() || `item-${index}`,
      sourceUrl: fullUrl,
      name: cleanName(rawName.trim()),
      rawName: rawName.trim(),
      imageUrl,
      brand: extractBrand(rawName),
      boxQuantity: extractBoxQuantity(rawName),
      pv,
    };
  });
}

async function fetchDetail(item) {
  try {
    const res = await fetch(item.sourceUrl, {
      headers: { 'User-Agent': 'GreenleafPOS-Catalog/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ...item, description: '', features: [] };
    const html = await res.text();
    const textMatch = html.match(/class="product__text[^"]*"[^>]*>(.*?)<\/div>\s*<\/div>/s);
    const description = textMatch ? stripHtml(textMatch[1]) : '';
    const summary = description.split(/Свойства\s*:/i)[0]?.trim() ?? '';
    const features = parseFeatures(description);
    return {
      ...item,
      description: summary.slice(0, 400),
      features,
    };
  } catch {
    return { ...item, description: '', features: [] };
  }
}

async function mapPool(items, fn, concurrency = 8) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
      if (idx % 10 === 0) process.stdout.write(`\r  ${idx + 1}/${items.length}`);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stdout.write('\n');
  return out;
}

console.log(`Fetching listing: ${SOURCE_URL}`);
const listingHtml = await fetch(SOURCE_URL).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
});

const listing = parseListing(listingHtml);
console.log(`Found ${listing.length} products — fetching details...`);

const products = await mapPool(listing, fetchDetail);

const payload = {
  source: SOURCE_URL,
  scrapedAt: new Date().toISOString(),
  count: products.length,
  products,
};

writeFileSync(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Wrote ${products.length} products to ${OUT_FILE}`);
