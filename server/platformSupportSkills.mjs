/** Destek atama — skill / etiket havuzları + kapasite (lite) */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const PATH = (dataDir) => join(dataDir, 'platform', 'support-skills.json');

const DEFAULT_DOC = {
  skills: [
    { id: 'billing', label: 'Fatura / ödeme', assignees: [], maxOpenCases: 0 },
    { id: 'technical', label: 'Teknik', assignees: [], maxOpenCases: 0 },
    { id: 'general', label: 'Genel', assignees: [], maxOpenCases: 0 },
  ],
  channelMap: {
    email: 'general',
    messaging: 'general',
    whatsapp: 'general',
    sms: 'general',
    instagram: 'general',
    contact_form: 'general',
  },
  tagMap: {},
};

function normalizeSkill(row) {
  const id = String(row?.id ?? '').trim().toLowerCase();
  if (!id) return null;
  return {
    id,
    label: String(row?.label ?? id).trim(),
    assignees: Array.isArray(row?.assignees) ? row.assignees.map((a) => String(a).trim()).filter(Boolean) : [],
    maxOpenCases: Math.max(0, Number(row?.maxOpenCases) || 0),
  };
}

export async function readSupportSkillsDocument(dataDir) {
  try {
    const raw = JSON.parse(await readFile(PATH(dataDir), 'utf8'));
    const skills = (Array.isArray(raw.skills) ? raw.skills : DEFAULT_DOC.skills).map(normalizeSkill).filter(Boolean);
    return {
      skills: skills.length ? skills : DEFAULT_DOC.skills,
      channelMap: { ...DEFAULT_DOC.channelMap, ...(raw.channelMap ?? {}) },
      tagMap: raw.tagMap && typeof raw.tagMap === 'object' ? raw.tagMap : {},
      updatedAt: raw.updatedAt ?? null,
    };
  } catch {
    return { ...DEFAULT_DOC, updatedAt: null };
  }
}

export async function writeSupportSkillsDocument(dataDir, body) {
  const skills = (Array.isArray(body?.skills) ? body.skills : []).map(normalizeSkill).filter(Boolean);
  const next = {
    skills: skills.length ? skills : DEFAULT_DOC.skills,
    channelMap: { ...DEFAULT_DOC.channelMap, ...(body?.channelMap ?? {}) },
    tagMap: body?.tagMap && typeof body.tagMap === 'object' ? body.tagMap : {},
    updatedAt: new Date().toISOString(),
  };
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  await writeFile(PATH(dataDir), JSON.stringify(next, null, 2), 'utf8');
  return { ok: true, ...next, path: 'data/platform/support-skills.json' };
}

function resolveSkillId(doc, { tags = [], channel = '' } = {}) {
  for (const tag of tags) {
    const key = String(tag).trim().toLowerCase();
    if (doc.tagMap[key]) return String(doc.tagMap[key]).trim().toLowerCase();
    const hit = doc.skills.find((s) => s.id === key);
    if (hit) return hit.id;
  }
  const ch = String(channel || '').trim().toLowerCase();
  if (doc.channelMap[ch]) return String(doc.channelMap[ch]).trim().toLowerCase();
  return 'general';
}

export async function countOpenCasesByAssignee(dataDir) {
  const { readPlatformCases } = await import('./platformCaseStore.mjs');
  const cases = await readPlatformCases(dataDir);
  const open = cases.filter((c) => c.status !== 'closed' && c.status !== 'solved');
  const counts = new Map();
  for (const c of open) {
    const who = String(c.assignee ?? '').trim();
    if (!who) continue;
    counts.set(who, (counts.get(who) ?? 0) + 1);
  }
  return counts;
}

export async function pickAssigneeForSkill(dataDir, context = {}) {
  const doc = await readSupportSkillsDocument(dataDir);
  const skillId = resolveSkillId(doc, context);
  const skill = doc.skills.find((s) => s.id === skillId) ?? doc.skills.find((s) => s.id === 'general');
  const pool = skill?.assignees?.length ? skill.assignees : null;
  if (!pool?.length) return { assignee: null, skillId, reason: 'empty_pool' };

  const openCounts = await countOpenCasesByAssignee(dataDir);
  const max = skill.maxOpenCases > 0 ? skill.maxOpenCases : Infinity;
  const eligible = pool.filter((u) => (openCounts.get(u) ?? 0) < max);
  const candidates = eligible.length ? eligible : pool;
  const stateKey = `skill:${skillId}`;
  const { readState, writeState } = await import('./platformSupportAssign.mjs');
  const state = await readState(dataDir);
  const idxMap = state.skillIndex ?? {};
  const last = Number(idxMap[stateKey] ?? -1);
  const next = (last + 1) % candidates.length;
  idxMap[stateKey] = next;
  await writeState(dataDir, { ...state, skillIndex: idxMap, updatedAt: new Date().toISOString() });
  return { assignee: candidates[next], skillId, reason: 'skill_round_robin' };
}
