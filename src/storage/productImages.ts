import { posLocalStorageKeys } from './posLocalStorageKeys';

function storageKey(): string {
  return posLocalStorageKeys().productImages;
}

export function loadAllImages(): Record<number, string> {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const result: Record<number, string> = {};
    for (const [id, url] of Object.entries(parsed)) {
      result[Number(id)] = url;
    }
    return result;
  } catch {
    return {};
  }
}

export function saveProductImage(productId: number, dataUrl: string): void {
  const all = loadAllImages();
  all[productId] = dataUrl;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(all));
  } catch (e) {
    console.error('Resim kaydedilemedi (depolama dolu):', e);
    throw new Error('Depolama dolu — daha küçük resim deneyin');
  }
}

export function removeProductImage(productId: number): void {
  const all = loadAllImages();
  delete all[productId];
  localStorage.setItem(storageKey(), JSON.stringify(all));
}

export function migrateImagesFromProducts(products: { id: number; imageUrl?: string }[]): void {
  const all = loadAllImages();
  let changed = false;
  for (const p of products) {
    if (p.imageUrl && !all[p.id]) {
      all[p.id] = p.imageUrl;
      changed = true;
    }
  }
  if (changed) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(all));
    } catch {
      /* ignore migration failure */
    }
  }
}
