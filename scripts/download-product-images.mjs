#!/usr/bin/env node
/**
 * Greenleaf ürün resimlerini indirir → public/product-images/p-{id}.{ext}
 * Kullanım: node scripts/download-product-images.mjs
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'public', 'product-images');
const MANIFEST = join(ROOT, 'src', 'data', 'productImageManifest.json');

const catalog = JSON.parse(readFileSync(join(ROOT, 'src/data/greenleafCatalog.json'), 'utf8'));
const seedUrls = JSON.parse(readFileSync(join(ROOT, 'src/data/seedProductImageUrls.json'), 'utf8'));

const NOFOTO = /nofoto/i;

function extFromUrl(url) {
  const ext = extname(new URL(url).pathname).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) return ext === '.jpeg' ? '.jpg' : ext;
  return '.jpg';
}

async function download(url, dest) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MarketPOS-ImageSync/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
}

mkdirSync(OUT_DIR, { recursive: true });

const jobs = [];

const GREENLEAF_ID_START = 37;

for (let index = 0; index < catalog.length; index += 1) {
  const item = catalog[index];
  const id = GREENLEAF_ID_START + index;
  if (!item.imageUrl || NOFOTO.test(item.imageUrl)) continue;
  jobs.push({ id, url: item.imageUrl });
}

for (const [idStr, url] of Object.entries(seedUrls)) {
  const id = Number(idStr);
  if (!url || NOFOTO.test(url)) continue;
  jobs.push({ id, url });
}

const manifest = {};
let ok = 0;
let fail = 0;

for (const { id, url } of jobs) {
  const ext = extFromUrl(url);
  const fileName = `p-${id}${ext}`;
  const dest = join(OUT_DIR, fileName);
  const publicPath = `/product-images/${fileName}`;
  try {
    if (!existsSync(dest)) {
      await download(url, dest);
    }
    manifest[id] = publicPath;
    ok += 1;
    process.stdout.write(`✓ ${id} ${fileName}\n`);
  } catch (e) {
    fail += 1;
    process.stderr.write(`✗ ${id} ${e instanceof Error ? e.message : e}\n`);
  }
}

writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`\nBitti: ${ok} indirildi, ${fail} hata → ${MANIFEST}`);
