/** Platform destek — smoke/QA thread’leri operasyon kuyruğundan gizle */

import { readFile } from 'node:fs/promises';
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
