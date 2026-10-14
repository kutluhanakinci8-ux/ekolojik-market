/** Platform destek — smoke/QA thread’leri operasyon kuyruğundan gizle */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_PATTERNS = [
  /\bqa\s*bot\b/i,
  /\bsmoke\b/i,
  /\bakis\s*a\s*smoke/i,
  /botiletisim/i,
  /\be2e\b/i,
  /\bfaz\d+/i,
  /^test[\s_-]?magaza/i,
];

const DEFAULT_TENANT_IDS = new Set(['test-magaza', 'demo-store']);

export async function readSupportFilterConfig(dataDir) {
  try {
    const raw = JSON.parse(await readFile(join(dataDir, 'platform', 'support-filters.json'), 'utf8'));
    return {
      hideSmoke: raw.hideSmoke !== false,
      subjectPatterns: Array.isArray(raw.subjectPatterns)
        ? raw.subjectPatterns.map((p) => new RegExp(String(p), 'i'))
        : DEFAULT_PATTERNS,
      customerNamePatterns: Array.isArray(raw.customerNamePatterns)
        ? raw.customerNamePatterns.map((p) => new RegExp(String(p), 'i'))
        : DEFAULT_PATTERNS,
      tenantIds: new Set(
        Array.isArray(raw.tenantIds) ? raw.tenantIds.map((t) => String(t).trim().toLowerCase()) : [...DEFAULT_TENANT_IDS],
      ),
    };
  } catch {
    return {
      hideSmoke: true,
      subjectPatterns: DEFAULT_PATTERNS,
      customerNamePatterns: DEFAULT_PATTERNS,
      tenantIds: DEFAULT_TENANT_IDS,
    };
  }
}

function haystack(thread) {
  return `${thread?.subject ?? ''} ${thread?.customerName ?? ''} ${thread?.lastMessagePreview ?? ''} ${thread?.customerEmail ?? ''}`;
}

export function isSmokeMessagingThread(thread, tenantId, config) {
  if (!config?.hideSmoke) return false;
  const tid = String(tenantId ?? '').trim().toLowerCase();
  if (config.tenantIds?.has(tid)) return true;
  const text = haystack(thread);
  for (const re of config.subjectPatterns ?? []) {
    if (re.test(text)) return true;
  }
  for (const re of config.customerNamePatterns ?? []) {
    if (re.test(text)) return true;
  }
  if (thread?.tags?.includes?.('smoke') || thread?.tags?.includes?.('qa')) return true;
  return false;
}

export function filterProductionMessagingThreads(threads, tenantId, config) {
  return (threads ?? []).filter((t) => !isSmokeMessagingThread(t, tenantId, config));
}

const FILTER_PATH = (dataDir) => join(dataDir, 'platform', 'support-filters.json');

function defaultFilterDocument() {
  return {
    hideSmoke: true,
    tenantIds: ['test-magaza', 'demo-store'],
    subjectPatterns: ['qa\\s*bot', 'smoke', 'botiletisim', 'e2e', 'faz\\d+', 'akis\\s*a\\s*smoke'],
    customerNamePatterns: ['qa\\s*bot', 'smoke', 'akis\\s*a\\s*smoke'],
  };
}

export async function readSupportFilterDocument(dataDir) {
  try {
    const raw = JSON.parse(await readFile(FILTER_PATH(dataDir), 'utf8'));
    return {
      hideSmoke: raw.hideSmoke !== false,
      tenantIds: Array.isArray(raw.tenantIds)
        ? raw.tenantIds.map((t) => String(t).trim()).filter(Boolean)
        : defaultFilterDocument().tenantIds,
      subjectPatterns: Array.isArray(raw.subjectPatterns)
        ? raw.subjectPatterns.map((p) => String(p).trim()).filter(Boolean)
        : defaultFilterDocument().subjectPatterns,
      customerNamePatterns: Array.isArray(raw.customerNamePatterns)
        ? raw.customerNamePatterns.map((p) => String(p).trim()).filter(Boolean)
        : defaultFilterDocument().customerNamePatterns,
    };
  } catch {
    return defaultFilterDocument();
  }
}

function compilePatternList(patterns, label) {
  const out = [];
  for (const p of patterns) {
    try {
      out.push(new RegExp(String(p), 'i'));
    } catch {
      throw new Error(`${label} geçersiz regex: ${p}`);
    }
  }
  return out;
}

export async function writeSupportFilterDocument(dataDir, input) {
  const doc = {
    hideSmoke: input?.hideSmoke !== false,
    tenantIds: Array.isArray(input?.tenantIds)
      ? input.tenantIds.map((t) => String(t).trim()).filter(Boolean)
      : [],
    subjectPatterns: Array.isArray(input?.subjectPatterns)
      ? input.subjectPatterns.map((p) => String(p).trim()).filter(Boolean)
      : [],
    customerNamePatterns: Array.isArray(input?.customerNamePatterns)
      ? input.customerNamePatterns.map((p) => String(p).trim()).filter(Boolean)
      : [],
  };
  compilePatternList(doc.subjectPatterns, 'Konu deseni');
  compilePatternList(doc.customerNamePatterns, 'Müşteri adı deseni');

  const dir = join(dataDir, 'platform');
  await mkdir(dir, { recursive: true });
  await writeFile(FILTER_PATH(dataDir), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { ok: true, filters: doc };
}
