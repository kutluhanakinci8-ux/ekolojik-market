import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { saveBillEmailInboxBatch } from './billEmailInboxStore.mjs';
import { patchPostaInboxFlags } from './postaInboxFlags.mjs';

const DEFAULT_RULES = [
  {
    id: 'rule-fatura-konu',
    enabled: true,
    name: 'Fatura konulu e-posta',
    subjectContains: 'fatura|e-fatura|invoice|fatura no',
    fromContains: '',
    routeToFatura: true,
    label: 'fatura',
  },
];

function rulesPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'posta-rules', tenantId, 'rules.json');
}

async function readRulesFile(dataDir, tenantId) {
  try {
    const parsed = JSON.parse(await readFile(rulesPath(dataDir, tenantId), 'utf8'));
    const rules = Array.isArray(parsed?.rules) ? parsed.rules : Array.isArray(parsed) ? parsed : [];
    return rules.length ? rules : DEFAULT_RULES;
  } catch {
    return DEFAULT_RULES;
  }
}

async function writeRulesFile(dataDir, tenantId, rules) {
  const path = rulesPath(dataDir, tenantId);
  await mkdir(join(dataDir, 'posta-rules', tenantId), { recursive: true });
  await writeFile(path, JSON.stringify({ rules, updatedAt: new Date().toISOString() }, null, 2), 'utf8');
}

function splitPatterns(raw) {
  return String(raw ?? '')
    .split('|')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function ruleMatchesMessage(rule, msg) {
  if (!rule?.enabled) return false;
  const subject = String(msg.subject ?? '').toLowerCase();
  const from = String(msg.from ?? '').toLowerCase();
  const subjectParts = splitPatterns(rule.subjectContains);
  const fromParts = splitPatterns(rule.fromContains);
  if (subjectParts.length && !subjectParts.some((p) => subject.includes(p))) return false;
  if (fromParts.length && !fromParts.some((p) => from.includes(p))) return false;
  if (!subjectParts.length && !fromParts.length) return false;
  return true;
}

export async function listPostaRules(dataDir, tenantId = 'main') {
  const rules = await readRulesFile(dataDir, tenantId);
  return { ok: true, rules };
}

export async function savePostaRules(dataDir, tenantId, rules) {
  const list = Array.isArray(rules) ? rules : [];
  const normalized = list.map((r) => ({
    id: String(r.id ?? `rule-${randomUUID()}`),
    enabled: r.enabled !== false,
    name: String(r.name ?? 'Kural'),
    subjectContains: String(r.subjectContains ?? ''),
    fromContains: String(r.fromContains ?? ''),
    routeToFatura: Boolean(r.routeToFatura),
    label: String(r.label ?? '').trim() || null,
  }));
  await writeRulesFile(dataDir, tenantId, normalized.length ? normalized : DEFAULT_RULES);
  return { ok: true, rules: normalized.length ? normalized : DEFAULT_RULES };
}

/**
 * IMAP ingest sonrası: eşleşenleri Fatura klasörüne ve etiketlere yönlendir.
 */
export async function applyPostaRulesToImapMessages(dataDir, tenantId, imapRows = []) {
  const rules = await readRulesFile(dataDir, tenantId);
  const billEntries = [];
  let labeled = 0;
  let routed = 0;

  for (const row of imapRows) {
    if (String(row.imapFolder ?? 'inbox').toLowerCase() !== 'inbox') continue;
    for (const rule of rules) {
      if (!ruleMatchesMessage(rule, row)) continue;
      if (rule.routeToFatura) {
        billEntries.push({
          imapUid: row.imapUid,
          messageId: row.messageId,
          sourceId: `rule:${rule.id}`,
          sourceLabel: rule.name || 'Kural: Fatura',
          from: row.from,
          to: row.to,
          subject: row.subject,
          receivedAt: row.receivedAt,
          snippet: row.snippet,
          matched: true,
        });
        routed += 1;
      }
      if (rule.label && row.id) {
        const flags = await patchPostaInboxFlags(dataDir, tenantId, row.id, {
          labels: [rule.label],
        });
        if (flags.ok) labeled += 1;
      }
      break;
    }
  }

  if (billEntries.length) {
    await saveBillEmailInboxBatch(dataDir, tenantId, billEntries);
  }

  return { ok: true, routed, labeled, rulesChecked: rules.length };
}
