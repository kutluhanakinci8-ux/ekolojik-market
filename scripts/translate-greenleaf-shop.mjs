#!/usr/bin/env node
/**
 * Greenleaf shop ürünlerini Rusça → Türkçe çevirir.
 * Kullanım: node scripts/translate-greenleaf-shop.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isBadTranslation } from './ruTrGlossary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../src/data/greenleafShopProducts.json');
const DELAY_MS = 350;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateText(text, from = 'ru', to = 'tr') {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length < 2) return '';

  const chunks = [];
  const maxLen = 450;
  let rest = trimmed;
  while (rest.length > 0) {
    if (rest.length <= maxLen) {
      chunks.push(rest);
      break;
    }
    let cut = rest.lastIndexOf(' ', maxLen);
    if (cut < maxLen * 0.5) cut = maxLen;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }

  const parts = [];
  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${from}|${to}`;
    const res = await fetch(url);
    const data = await res.json();
    const translated = data?.responseData?.translatedText ?? chunk;
    if (isBadTranslation(translated)) {
      throw new Error('MyMemory günlük kota doldu. repair-greenleaf-shop-tr.mjs kullanın.');
    }
    parts.push(translated);
    await sleep(DELAY_MS);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function splitFeatureBullets(text) {
  return text
    .split(/(?=[А-ЯA-Z][а-яa-z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

async function translateProduct(product, index, total) {
  if (product.nameTr && product.descriptionTr) {
    process.stdout.write(`\r  ${index + 1}/${total} (önbellek) ${product.nameTr.slice(0, 40)}...`);
    return product;
  }

  process.stdout.write(`\r  ${index + 1}/${total} çevriliyor...`);

  const nameTr = await translateText(product.name);
  const descriptionTr = product.description ? await translateText(product.description) : '';

  let featuresTr = [];
  if (product.features?.length) {
    const bullets = product.features.flatMap(splitFeatureBullets);
    for (const bullet of bullets.slice(0, 10)) {
      const tr = await translateText(bullet);
      if (tr) featuresTr.push(tr);
    }
  }

  return {
    ...product,
    nameTr,
    descriptionTr,
    featuresTr,
  };
}

const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
console.log(`Çeviri başlıyor: ${raw.products.length} ürün (ru → tr)`);

const products = [];
for (let i = 0; i < raw.products.length; i++) {
  products.push(await translateProduct(raw.products[i], i, raw.products.length));
}

const payload = {
  ...raw,
  translatedAt: new Date().toISOString(),
  locale: 'tr',
  products,
};

writeFileSync(DATA_FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`\n✓ Türkçe çeviri kaydedildi: ${DATA_FILE}`);
