import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PLAN_MRR_TRY } from './platformBillingMetrics.mjs';

const SETTINGS_PATH = (dataDir) => join(dataDir, 'platform', 'console-settings.json');

export const DEFAULT_CONSOLE_SETTINGS = {
  maintenanceBanner: {
    enabled: false,
    message: '',
  },
  operatorNotes: '',
  defaultTrialDays: 14,
  planMrrTryOverrides: {},
};

export async function readConsoleSettings(dataDir) {
  try {
    const raw = JSON.parse(await readFile(SETTINGS_PATH(dataDir), 'utf8'));
    return {
      ...DEFAULT_CONSOLE_SETTINGS,
      ...raw,
      maintenanceBanner: {
        ...DEFAULT_CONSOLE_SETTINGS.maintenanceBanner,
        ...(raw.maintenanceBanner ?? {}),
      },
      planMrrTryOverrides: {
        ...DEFAULT_CONSOLE_SETTINGS.planMrrTryOverrides,
        ...(raw.planMrrTryOverrides ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_CONSOLE_SETTINGS };
  }
}

export async function writeConsoleSettings(dataDir, patch) {
  const current = await readConsoleSettings(dataDir);
  const next = {
    ...current,
    ...patch,
    maintenanceBanner: {
      ...current.maintenanceBanner,
      ...(patch.maintenanceBanner ?? {}),
    },
    planMrrTryOverrides: patch.planMrrTryOverrides
      ? { ...current.planMrrTryOverrides, ...patch.planMrrTryOverrides }
      : current.planMrrTryOverrides,
    updatedAt: new Date().toISOString(),
  };
  const days = Number(next.defaultTrialDays);
  next.defaultTrialDays = Number.isFinite(days) ? Math.min(90, Math.max(1, Math.round(days))) : 14;
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  await writeFile(SETTINGS_PATH(dataDir), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export async function getDefaultTrialDays(dataDir) {
  const s = await readConsoleSettings(dataDir);
  const days = Number(s.defaultTrialDays);
  return Number.isFinite(days) ? Math.min(90, Math.max(1, Math.round(days))) : 14;
}

export function resolvePlanMrrTry(plan, overrides = {}) {
  const key = String(plan ?? '').trim().toLowerCase() || 'trial';
  const base = PLAN_MRR_TRY[key] ?? 0;
  const override = overrides[key];
  if (override == null || override === '') return base;
  const n = Number(override);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : base;
}

export function listPlanMrrCatalog(overrides = {}) {
  return Object.keys(PLAN_MRR_TRY).map((plan) => ({
    plan,
    defaultMrrTry: PLAN_MRR_TRY[plan],
    effectiveMrrTry: resolvePlanMrrTry(plan, overrides),
    overridden: overrides[plan] != null && overrides[plan] !== '',
  }));
}
