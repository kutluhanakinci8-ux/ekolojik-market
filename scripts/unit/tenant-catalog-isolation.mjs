import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** ts derlenmeden — mantık kopyası ile smoke; tam testler tsx ile genişletilebilir */
function looksLikeMainGreenleafCatalog(products) {
  if (!products?.length || products.length < 30) return false;
  let seedHits = 0;
  for (const p of products) {
    const id = Number(p.id);
    if (id >= 1 && id <= 200) seedHits += 1;
  }
  if (products.length >= 80 && seedHits / products.length >= 0.75) return true;
  if (products.length >= 30 && seedHits === products.length) return true;
  return false;
}

const fake137 = Array.from({ length: 137 }, (_, i) => ({ id: i + 1, category: 'kisisel-bakim' }));
assert.equal(looksLikeMainGreenleafCatalog(fake137), true);
assert.equal(looksLikeMainGreenleafCatalog([{ id: 1001 }, { id: 1002 }]), false);

console.log('tenant-catalog-isolation.mjs OK');
