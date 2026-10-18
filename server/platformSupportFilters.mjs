/** Platform destek — smoke/QA thread’leri operasyon kuyruğundan gizle */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listMessagingMessages } from './messaging/store.mjs';

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
      slaHumanOnly: raw.slaHumanOnly === true,
      messagingChannels: Array.isArray(raw.messagingChannels)
        ? raw.messagingChannels.map((c) => String(c).trim().toLowerCase()).filter(Boolean)
        : null,
    };
  } catch {
    return {
      hideSmoke: true,
      subjectPatterns: DEFAULT_PATTERNS,
      customerNamePatterns: DEFAULT_PATTERNS,
      tenantIds: DEFAULT_TENANT_IDS,
      slaHumanOnly: false,
      messagingChannels: null,
    };
  }
}

function haystack(thread) {
  return `${thread?.subject ?? ''} ${thread?.customerName ?? ''} ${thread?.lastMessagePreview ?? ''} ${thread?.customerEmail ?? ''}`;
}

export function configFromFilterDocument(doc) {
  const tenantIds = Array.isArray(doc?.tenantIds)
    ? doc.tenantIds.map((t) => String(t).trim().toLowerCase()).filter(Boolean)
    : [...DEFAULT_TENANT_IDS];
  return {
    hideSmoke: doc?.hideSmoke !== false,
    subjectPatterns: Array.isArray(doc?.subjectPatterns)
      ? doc.subjectPatterns.map((p) => new RegExp(String(p), 'i'))
      : DEFAULT_PATTERNS,
    customerNamePatterns: Array.isArray(doc?.customerNamePatterns)
      ? doc.customerNamePatterns.map((p) => new RegExp(String(p), 'i'))
      : DEFAULT_PATTERNS,
    tenantIds: new Set(tenantIds),
    slaHumanOnly: doc?.slaHumanOnly === true,
    messagingChannels: Array.isArray(doc?.messagingChannels)
      ? doc.messagingChannels.map((c) => String(c).trim().toLowerCase()).filter(Boolean)
      : null,
  };
}

export function smokeMessagingThreadReason(thread, tenantId, config) {
  if (!config?.hideSmoke) return null;
  const tid = String(tenantId ?? '').trim().toLowerCase();
  if (config.tenantIds?.has(tid)) return { code: 'tenant', label: `Kiracı: ${tenantId}` };
  const text = haystack(thread);
  for (const re of config.subjectPatterns ?? []) {
    if (re.test(text)) return { code: 'subject', label: `Konu deseni: ${re}` };
  }
  for (const re of config.customerNamePatterns ?? []) {
    if (re.test(text)) return { code: 'customer', label: `Müşteri deseni: ${re}` };
  }
  if (thread?.tags?.includes?.('smoke')) return { code: 'tag', label: 'Etiket: smoke' };
  if (thread?.tags?.includes?.('qa')) return { code: 'tag', label: 'Etiket: qa' };
  return null;
}

export function isSmokeMessagingThread(thread, tenantId, config) {
  return Boolean(smokeMessagingThreadReason(thread, tenantId, config));
}

/** slaHumanOnly: ilk personel yanıtı bot ise SLA uyum örneklerine dahil etme */
export async function threadEligibleForSlaHuman(dataDir, tenantId, thread, slaHumanOnly) {
  if (!slaHumanOnly) return true;
  if (!thread?.firstStaffResponseAt) return true;
  const listed = await listMessagingMessages(dataDir, tenantId, thread.id, { limit: 100 });
  const firstStaff = (listed.messages ?? []).find((m) => m.direction === 'staff');
  if (!firstStaff) return false;
  return firstStaff.messageKind !== 'bot';
}

export function filterProductionMessagingThreads(threads, tenantId, config) {
  return (threads ?? []).filter((t) => {
    if (isSmokeMessagingThread(t, tenantId, config)) return false;
    const allow = config?.messagingChannels;
    if (allow?.length) {
      const ch = String(t.channel ?? 'web').trim().toLowerCase();
      if (!allow.includes(ch)) return false;
    }
    return true;
  });
}

const FILTER_PATH = (dataDir) => join(dataDir, 'platform', 'support-filters.json');

function defaultFilterDocument() {
  return {
    hideSmoke: true,
    tenantIds: ['test-magaza', 'demo-store'],
    subjectPatterns: ['qa\\s*bot', 'smoke', 'botiletisim', 'e2e', 'faz\\d+', 'akis\\s*a\\s*smoke'],
    customerNamePatterns: ['qa\\s*bot', 'smoke', 'akis\\s*a\\s*smoke'],
    slaHumanOnly: false,
    messagingChannels: [],
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
      slaHumanOnly: raw.slaHumanOnly === true,
      messagingChannels: Array.isArray(raw.messagingChannels)
        ? raw.messagingChannels.map((c) => String(c).trim().toLowerCase()).filter(Boolean)
        : [],
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
    slaHumanOnly: input?.slaHumanOnly === true,
    messagingChannels: Array.isArray(input?.messagingChannels)
      ? input.messagingChannels.map((c) => String(c).trim().toLowerCase()).filter(Boolean)
      : [],
  };
  compilePatternList(doc.subjectPatterns, 'Konu deseni');
  compilePatternList(doc.customerNamePatterns, 'Müşteri adı deseni');

  const dir = join(dataDir, 'platform');
  await mkdir(dir, { recursive: true });
  await writeFile(FILTER_PATH(dataDir), `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return { ok: true, filters: doc };
}

export async function previewSmokeMessagingFilter(dataDir, draftDocument, { sampleLimit = 25 } = {}) {
  const doc = draftDocument ?? (await readSupportFilterDocument(dataDir));
  let config;
  try {
    config = configFromFilterDocument(doc);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Filtre geçersiz',
    };
  }

  const { listTenantIds, readTenantStore } = await import('./tenantAuth.mjs');
  const { listMessagingThreads } = await import('./messaging/store.mjs');
  const ids = ['main', ...(await listTenantIds(dataDir))];
  const tenantIds = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];

  const hiddenSamples = [];
  let hiddenTotal = 0;
  let visibleTotal = 0;

  for (const tenantId of tenantIds) {
    const store = await readTenantStore(dataDir, tenantId);
    const businessName =
      String(store?.settings?.businessName ?? '').trim()
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    const listed = await listMessagingThreads(dataDir, tenantId, { limit: 200, includeArchived: false });
    for (const thread of listed.threads ?? []) {
      const reason = smokeMessagingThreadReason(thread, tenantId, config);
      if (reason) {
        hiddenTotal += 1;
        if (hiddenSamples.length < sampleLimit) {
          hiddenSamples.push({
            tenantId,
            businessName,
            threadId: thread.id,
            subject: thread.subject ?? '—',
            customerName: thread.customerName ?? '—',
            reason: reason.label,
            reasonCode: reason.code,
          });
        }
      } else {
        visibleTotal += 1;
      }
    }
  }

  return {
    ok: true,
    hideSmoke: config.hideSmoke,
    hiddenTotal,
    visibleTotal,
    samples: hiddenSamples,
    filters: doc,
  };
}
