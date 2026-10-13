import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POLICY_PATH = (dataDir) => join(dataDir, 'platform', 'support-sla.json');

export const CLOSED_CASE_INBOUND_MODES = ['reopen', 'keep_closed', 'new_case'];

export const DEFAULT_SUPPORT_SLA_POLICY = {
  firstResponseTargetMinutes: 240,
  staleWaitingHours: 24,
  windowDaysDefault: 14,
  /** Kapalı/çözüldü kayda gelen e-posta: reopen | keep_closed | new_case */
  closedCaseInbound: 'reopen',
};

export async function readSupportSlaPolicy(dataDir) {
  try {
    const raw = JSON.parse(await readFile(POLICY_PATH(dataDir), 'utf8'));
    return {
      ...DEFAULT_SUPPORT_SLA_POLICY,
      ...raw,
    };
  } catch {
    return { ...DEFAULT_SUPPORT_SLA_POLICY };
  }
}

export async function writeSupportSlaPolicy(dataDir, patch) {
  const current = await readSupportSlaPolicy(dataDir);
  const merged = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  await writeFile(POLICY_PATH(dataDir), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}
