/** Destek kaydı — operatör round-robin atama */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readPlatformOperatorsMeta } from './platformAuth.mjs';

const STATE_PATH = (dataDir) => join(dataDir, 'platform', 'support-assign-state.json');

export function isSupportAutoAssignEnabled() {
  const flag = process.env.EKOLOJIK_SUPPORT_AUTO_ASSIGN?.trim();
  if (flag === '0' || flag === 'false') return false;
  return true;
}

export async function readState(dataDir) {
  try {
    return JSON.parse(await readFile(STATE_PATH(dataDir), 'utf8'));
  } catch {
    return { lastIndex: -1, skillIndex: {} };
  }
}

export async function writeState(dataDir, state) {
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  await writeFile(STATE_PATH(dataDir), JSON.stringify(state, null, 2), 'utf8');
}

export async function listSupportAssigneeOptions(dataDir) {
  const meta = await readPlatformOperatorsMeta(dataDir);
  return (meta.operators ?? []).map((o) => ({
    username: o.username,
    displayName: o.displayName ?? o.username,
  }));
}

export async function pickSupportAssignee(dataDir, context = {}) {
  if (!isSupportAutoAssignEnabled()) return null;
  try {
    const { pickAssigneeForSkill } = await import('./platformSupportSkills.mjs');
    const skilled = await pickAssigneeForSkill(dataDir, context);
    if (skilled.assignee) return skilled.assignee;
  } catch {
    /* fallback */
  }
  const options = await listSupportAssigneeOptions(dataDir);
  const active = options.map((o) => o.username).filter(Boolean);
  if (!active.length) return null;
  const state = await readState(dataDir);
  const next = (Number(state.lastIndex) + 1) % active.length;
  await writeState(dataDir, { ...state, lastIndex: next, updatedAt: new Date().toISOString() });
  return active[next];
}
