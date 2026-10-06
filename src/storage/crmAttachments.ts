const STORAGE_KEY = 'market-pos-crm-attachments';

type AttachmentStore = Record<string, string>;

function loadAll(): AttachmentStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as AttachmentStore;
  } catch {
    return {};
  }
}

function saveAll(data: AttachmentStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function crmAttachmentKey(customerId: string, documentId: string): string {
  return `${customerId}::${documentId}`;
}

export function saveCrmAttachment(key: string, dataUrl: string): void {
  const all = loadAll();
  all[key] = dataUrl;
  try {
    saveAll(all);
  } catch {
    throw new Error('Ek dosya kaydedilemedi — depolama dolu olabilir.');
  }
}

export function loadCrmAttachment(key: string): string | undefined {
  return loadAll()[key];
}

export function removeCrmAttachment(key: string): void {
  const all = loadAll();
  delete all[key];
  saveAll(all);
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsDataURL(file);
  });
}
