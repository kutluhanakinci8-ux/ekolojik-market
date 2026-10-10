#!/usr/bin/env node
/**
 * Lima Market — perakende KDV (canlı store.json)
 *
 * ourPriceWithVat liste fiyatına eşit veya daha düşükse brüt = net × 1.2 yapılır.
 *
 *   node scripts/lima-sync-retail-vat.mjs --data-dir /var/www/market-pos/data
 *   node scripts/lima-sync-retail-vat.mjs --data-dir ./data --dry-run
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const VAT = 1.2;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let dataDir = join(process.cwd(), 'data');
  let dryRun = false;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--data-dir' && args[i + 1]) {
      dataDir = args[i + 1];
      i += 1;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }
  return { dataDir, dryRun };
}

function needsRetailVatSync(product) {
  const net = Number(product.fullSalePrice);
  const gross = Number(product.ourPriceWithVat);
  if (!Number.isFinite(net) || net <= 0) return false;
  if (!Number.isFinite(gross)) return true;
  return gross <= net * 1.02;
}

function syncProduct(product) {
  const net = Number(product.fullSalePrice);
  return {
    ...product,
    ourPriceWithVat: round2(net * VAT),
  };
}

async function main() {
  const { dataDir, dryRun } = parseArgs();
  const storePath = join(dataDir, 'tenants', 'lima-market', 'store.json');
  const raw = await readFile(storePath, 'utf8');
  const store = JSON.parse(raw);
  const products = store.products ?? [];
  let changed = 0;

  store.products = products.map((p) => {
    if (!needsRetailVatSync(p)) return p;
    changed += 1;
    const next = syncProduct(p);
    console.log(
      `  ${p.productCode ?? p.id}: liste ${p.fullSalePrice} → brüt ${p.ourPriceWithVat} ⇒ ${next.ourPriceWithVat}`,
    );
    return next;
  });

  console.log(`\n${changed} ürün güncellenecek${dryRun ? ' (dry-run)' : ''}.`);
  if (!dryRun && changed > 0) {
    await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    console.log(`Kaydedildi: ${storePath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
