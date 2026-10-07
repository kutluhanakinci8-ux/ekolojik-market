import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { saveBillEmailInboxBatch } from './billEmailInboxStore.mjs';
import { patchPostaInboxFlags } from './postaInboxFlags.mjs';

export const POSTA_RULES_ENGINE_VERSION = 2;

const DEFAULT_RULES = [
  {
    id: 'rule-fatura-konu',
    enabled: true,
    name: 'Fatura konulu e-posta',
    subjectContains: 'fatura|e-fatura|invoice|fatura no',
    fromContains: '',
    matchGroups: [
      { subjectContains: 'fatura|e-fatura|invoice|fatura no', fromContains: '' },
      { subjectContains: '', fromContains: 'fatura@|billing@|muhasebe@' },
    ],
    minAttachmentBytes: 0,
    maxAttachmentBytes: null,
    routeToFatura: true,
    label: 'fatura',
    rulesVersion: POSTA_RULES_ENGINE_VERSION,
  },
];

function rulesPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'posta-rules', tenantId, 'rules.json');
}

async function readRulesFile(dataDir, tenantId) {
  try {
    const parsed = JSON.parse(await readFile(rulesPath(dataDir, tenantId), 'utf8'));
    const rules = Array.isArray(parsed?.rules) ? parsed.rules : Array.isArray(parsed) ? parsed : [];
    return rules.length ? rules.map(normalizeRuleShape) : DEFAULT_RULES.map(normalizeRuleShape);
  } catch {
    return DEFAULT_RULES.map(normalizeRuleShape);
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

export function sumMessageAttachmentBytes(msg) {
  const list = msg?.attachments;
  if (!Array.isArray(list) || !list.length) return 0;
  return list.reduce((sum, a) => sum + (Number(a?.size) || 0), 0);
}

function normalizeMatchGroups(rule) {
  if (Array.isArray(rule.matchGroups) && rule.matchGroups.length) {
    return rule.matchGroups.map((g) => ({
      subjectContains: String(g.subjectContains ?? ''),
      fromContains: String(g.fromContains ?? ''),
    }));
  }
  return [
    {
      subjectContains: String(rule.subjectContains ?? ''),
      fromContains: String(rule.fromContains ?? ''),
    },
  ];
}

export function normalizeRuleShape(rule) {
  const matchGroups = normalizeMatchGroups(rule);
  const first = matchGroups[0] ?? { subjectContains: '', fromContains: '' };
  const maxRaw = rule.maxAttachmentBytes;
  const maxAttachmentBytes =
    maxRaw === null || maxRaw === undefined || maxRaw === ''
      ? null
      : Math.max(0, Number(maxRaw) || 0);

  return {
    id: String(rule.id ?? `rule-${randomUUID()}`),
    enabled: rule.enabled !== false,
    name: String(rule.name ?? 'Kural'),
    subjectContains: first.subjectContains,
    fromContains: first.fromContains,
    matchGroups,
    minAttachmentBytes: Math.max(0, Number(rule.minAttachmentBytes) || 0),
    maxAttachmentBytes,
    routeToFatura: Boolean(rule.routeToFatura),
    label: String(rule.label ?? '').trim() || null,
    rulesVersion: POSTA_RULES_ENGINE_VERSION,
  };
}

function groupMatchesMessage(group, msg) {
  const subject = String(msg.subject ?? '').toLowerCase();
  const from = String(msg.from ?? '').toLowerCase();
  const subjectParts = splitPatterns(group.subjectContains);
  const fromParts = splitPatterns(group.fromContains);
  if (!subjectParts.length && !fromParts.length) return false;
  if (subjectParts.length && !subjectParts.some((p) => subject.includes(p))) return false;
  if (fromParts.length && !fromParts.some((p) => from.includes(p))) return false;
  return true;
}

export function ruleMatchesMessage(rule, msg) {
  if (!rule?.enabled) return false;
  const normalized = normalizeRuleShape(rule);
  const groupHit = normalized.matchGroups.some((g) => groupMatchesMessage(g, msg));
  if (!groupHit) return false;

  const bytes = sumMessageAttachmentBytes(msg);
  if (normalized.minAttachmentBytes > 0 && bytes < normalized.minAttachmentBytes) return false;
  if (
    normalized.maxAttachmentBytes != null &&
    Number.isFinite(normalized.maxAttachmentBytes) &&
    bytes > normalized.maxAttachmentBytes
  ) {
    return false;
  }
  return true;
}

export function getPostaRulesCapabilities() {
  return {
    ok: true,
    version: POSTA_RULES_ENGINE_VERSION,
    features: ['matchGroupsOr', 'subjectContains', 'fromContains', 'minAttachmentBytes', 'maxAttachmentBytes'],
    note: 'matchGroups içinde AND; gruplar arası OR (NB PM-9 G5+)',
  };
}

export async function listPostaRules(dataDir, tenantId = 'main') {
  const rules = await readRulesFile(dataDir, tenantId);
  return { ok: true, rules, capabilities: getPostaRulesCapabilities() };
}

export async function savePostaRules(dataDir, tenantId, rules) {
  const list = Array.isArray(rules) ? rules : [];
  const normalized = list.map((r) => normalizeRuleShape(r));
  await writeRulesFile(dataDir, tenantId, normalized.length ? normalized : DEFAULT_RULES.map(normalizeRuleShape));
  return { ok: true, rules: normalized.length ? normalized : DEFAULT_RULES.map(normalizeRuleShape) };
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
