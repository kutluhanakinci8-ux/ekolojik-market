#!/usr/bin/env node
/**
 * Greenleaf "Новый товар" sayfasından ürün listesini çeker.
 * Kullanım: node scripts/scrape-greenleaf.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_URL = 'https://greenleaf-global.com/shop/novyiy-tovar/';
const OUT_FILE = join(__dirname, '../src/data/greenleafCatalog.json');

const html = await fetch(SOURCE_URL).then((r) => {
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${SOURCE_URL}`);
  return r.text();
});

const titles = [...html.matchAll(/<a class="card-product__title" href="([^"]+)">([^<]+)<\/a>/g)];
const imgs = new Map(
  [...html.matchAll(/<a class="card-product__img" href="([^"]+)"><img[^>]+src="([^"]+)"/g)].map(
    ([, url, src]) => [url, src],
  ),
);
const blocks = [
  ...html.matchAll(/<div class="card-product">(.*?)(?=<div class="col-lg-4|<div class="pagination)/gs),
].map((m) => m[1]);

const items = titles.map(([url, name], index) => {
  const block = blocks[index] ?? '';
  const prices = [...block.matchAll(/itemProp="price" content="([^"]+)"/g)].map((m) => m[1]);
  const usd = prices[0] ? Number.parseFloat(prices[0]) : 0;
  const coupon = prices[1] ? Number.parseFloat(prices[1]) : 0;
  let pv = null;
  for (const sticker of block.matchAll(/card-product__sticker[^>]*>([^<]+)</g)) {
    const match = sticker[1].match(/(\d+[.,]?\d*)\s*PV/i);
    if (match) pv = Number.parseFloat(match[1].replace(',', '.'));
  }
  let imageUrl = imgs.get(url) ?? null;
  if (imageUrl?.startsWith('/')) imageUrl = `https://greenleaf-global.com${imageUrl}`;

  return {
    slug: url.replace(/\/$/, '').split('/').pop(),
    sourceUrl: `https://greenleaf-global.com${url}`,
    name: name.trim(),
    imageUrl,
    usdPrice: usd,
    couponPrice: coupon,
    pv,
  };
});

writeFileSync(OUT_FILE, `${JSON.stringify(items, null, 2)}\n`, 'utf8');
console.log(`Wrote ${items.length} products to ${OUT_FILE}`);
