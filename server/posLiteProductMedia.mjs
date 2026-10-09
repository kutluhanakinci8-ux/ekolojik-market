function isPosLiteStore(store) {
  return store?.settings?.productProfile === 'pos-lite';
}

function imageMapFromSettings(settings) {
  const raw = settings?.posLiteCatalogImageByProductId;
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

function urlMapFromSettings(settings) {
  const raw = settings?.posLiteImageUrlByProductId;
  if (!raw || typeof raw !== 'object') return null;
  return raw;
}

/**
 * GET / kayıt: eksik görsel alanlarını settings haritasından tamamla.
 */
export function enrichPosLiteProductMedia(store) {
  if (!isPosLiteStore(store)) return { store, changed: false };
  const catalogMap = imageMapFromSettings(store.settings);
  const urlMap = urlMapFromSettings(store.settings);
  if (!catalogMap && !urlMap) return { store, changed: false };

  let changed = false;
  const products = (store.products ?? []).map((p) => {
    const mappedCatalog = catalogMap?.[String(p.id)];
    const mappedUrl = urlMap?.[String(p.id)];
    const catalogImageId = p.catalogImageId ?? mappedCatalog;
    const imageUrl =
      (p.imageUrl?.startsWith('/product-images/') ? p.imageUrl : undefined)
      ?? (mappedUrl?.startsWith('/product-images/') ? mappedUrl : undefined);
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
  const catalogMap = imageMapFromSettings(incoming.settings ?? existing?.settings);
  const urlMap = urlMapFromSettings(incoming.settings ?? existing?.settings);

  const products = incoming.products.map((p) => {
    const prev = prevById.get(p.id);
    const catalogImageId = p.catalogImageId ?? prev?.catalogImageId ?? catalogMap?.[String(p.id)];
    const imageUrl =
      (p.imageUrl?.startsWith('/product-images/') ? p.imageUrl : undefined)
      ?? (prev?.imageUrl?.startsWith('/product-images/') ? prev.imageUrl : undefined)
      ?? (urlMap?.[String(p.id)]?.startsWith('/product-images/') ? urlMap[String(p.id)] : undefined);
    return {
      ...p,
      ...(catalogImageId != null ? { catalogImageId } : {}),
      ...(imageUrl ? { imageUrl } : {}),
    };
  });

  return { ...incoming, products };
}
