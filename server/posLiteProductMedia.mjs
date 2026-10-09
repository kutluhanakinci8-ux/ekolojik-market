import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
function isPosLiteStore(store) {
  return store?.settings?.productProfile === 'pos-lite';
}

const manifest = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../src/data/productImageManifest.json'),
    'utf8',
  ),
);

function catalogPathForSourceId(sourceId) {
  if (sourceId == null) return undefined;
  return manifest[String(sourceId)];
}

function imageMapFromSettings(settings) {
  const raw = settings?.posLiteCatalogImageByProductId;
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

/**
 * GET / kayıt: eksik görsel alanlarını settings haritasından tamamla.
 */
export function enrichPosLiteProductMedia(store) {
  if (!isPosLiteStore(store)) return { store, changed: false };
  const map = imageMapFromSettings(store.settings);
  if (!map) return { store, changed: false };

  let changed = false;
  const products = (store.products ?? []).map((p) => {
    const mapped = map[String(p.id)];
    const catalogImageId = p.catalogImageId ?? mapped;
    const imageUrl =
      p.imageUrl?.startsWith('/product-images/')
        ? p.imageUrl
        : catalogPathForSourceId(catalogImageId);
    if (catalogImageId === p.catalogImageId && imageUrl === p.imageUrl) return p;
    changed = true;
    return {
      ...p,
      ...(catalogImageId != null ? { catalogImageId } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    };
  });

  if (!changed) return { store, changed: false };
  return {
    store: { ...store, products, updatedAt: new Date().toISOString() },
    changed: true,
  };
}

/** PUT: istemci eski bundle ile yazsa bile görsel alanlarını koru */
export function mergePosLiteProductMediaOnWrite(existing, incoming) {
  if (!isPosLiteStore(incoming ?? existing)) return incoming;
  if (!Array.isArray(incoming?.products)) return incoming;

  const prevById = new Map((existing?.products ?? []).map((p) => [p.id, p]));
  const map = imageMapFromSettings(incoming.settings ?? existing?.settings);

  const products = incoming.products.map((p) => {
    const prev = prevById.get(p.id);
    const catalogImageId = p.catalogImageId ?? prev?.catalogImageId ?? map?.[String(p.id)];
    const imageUrl =
      (p.imageUrl?.startsWith('/product-images/') ? p.imageUrl : undefined)
      ?? (prev?.imageUrl?.startsWith('/product-images/') ? prev.imageUrl : undefined)
      ?? catalogPathForSourceId(catalogImageId);
    return {
      ...p,
      ...(catalogImageId != null ? { catalogImageId } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    };
  });

  return { ...incoming, products };
}
