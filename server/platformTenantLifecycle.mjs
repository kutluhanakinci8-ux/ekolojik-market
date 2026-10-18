/** Platform — kiracı yaşam döngüsü, askıya alma ve operasyon notları */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore, listTenantIds } from './tenantAuth.mjs';
import {
  getTenantAllowlist,
  isStrictTenantAllowlistEnabled,
  isTenantAllowlisted,
  normalizeTenantId,
} from './tenantAllowlist.mjs';

const OVERRIDES_PATH = (dataDir) => join(dataDir, 'platform', 'tenant-lifecycle.json');

export const LIFECYCLE_STATUS_LABELS = {
  active: 'Aktif',
  trial: 'Deneme',
  trial_expired: 'Deneme bitti',
  suspended: 'Askıda',
  missing_store: 'Veri eksik',
};

async function readRegistrations(dataDir) {
  try {
    const raw = JSON.parse(await readFile(join(dataDir, 'registrations.json'), 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export async function readTenantLifecycleOverrides(dataDir) {
  try {
    const raw = JSON.parse(await readFile(OVERRIDES_PATH(dataDir), 'utf8'));
    return raw?.tenants && typeof raw.tenants === 'object' ? raw.tenants : {};
  } catch {
    return {};
  }
}

export async function writeTenantLifecycleOverrides(dataDir, tenantsMap) {
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    tenants: tenantsMap,
  };
  await writeFile(OVERRIDES_PATH(dataDir), JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

function parseTime(iso) {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : null;
}

function daysUntil(iso) {
  const t = parseTime(iso);
  if (t == null) return null;
  return Math.ceil((t - Date.now()) / 86400000);
}

export function computeLifecycleStatus({
  tenantId,
  store,
  plan,
  trialEndsAt,
  override,
}) {
  if (override?.suspended === true) {
    return { status: 'suspended', reason: 'platform_suspend' };
  }
  if (!store) {
    return { status: 'missing_store', reason: 'no_store' };
  }
  const planNorm = String(plan ?? store?.settings?.tenantMeta?.plan ?? '').toLowerCase();
  const trialEnd = trialEndsAt ?? store?.settings?.tenantMeta?.trialEndsAt ?? null;
  const trialMs = parseTime(trialEnd);
  const isTrialPlan = !planNorm || planNorm === 'trial' || planNorm === 'pos-lite';
  if (isTrialPlan && trialMs != null && trialMs < Date.now()) {
    return { status: 'trial_expired', reason: 'trial_ended' };
  }
  if (isTrialPlan && trialMs != null && trialMs >= Date.now()) {
    return { status: 'trial', reason: 'trial_active' };
  }
  return { status: 'active', reason: 'paid_or_open' };
}

export async function getTenantLifecycleFlags(dataDir, tenantId) {
  const id = normalizeTenantId(tenantId);
  const overrides = await readTenantLifecycleOverrides(dataDir);
  const row = overrides[id] ?? {};
  return {
    suspended: row.suspended === true,
    readOnly: row.readOnly === true,
    opsNotes: String(row.opsNotes ?? '').trim(),
  };
}

export async function isTenantReadOnly(dataDir, tenantId) {
  const flags = await getTenantLifecycleFlags(dataDir, tenantId);
  return flags.readOnly;
}

export async function assertTenantLoginAllowed(dataDir, tenantId) {
  const id = normalizeTenantId(tenantId);
  if (id === '__platform__') return { ok: true };
  const flags = await getTenantLifecycleFlags(dataDir, id);
  if (flags.suspended) {
    return {
      ok: false,
      message: 'Bu mağaza hesabı platform tarafından askıya alındı. Destek ile iletişime geçin.',
    };
  }
  const store = await readTenantStore(dataDir, id);
  const status = computeLifecycleStatus({
    tenantId: id,
    store,
    plan: store?.settings?.tenantMeta?.plan,
    trialEndsAt: store?.settings?.tenantMeta?.trialEndsAt,
    override: flags,
  });
  if (status.status === 'trial_expired') {
    return {
      ok: false,
      message: 'Deneme süresi sona erdi. Abonelik yenileme için platform operatörü ile görüşün.',
    };
  }
  return { ok: true };
}

async function allTenantIds(dataDir) {
  const ids = ['main', ...(await listTenantIds(dataDir))];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

export async function buildPlatformTenantsLifecycle(dataDir) {
  const registrations = await readRegistrations(dataDir);
  const regByTenant = new Map(registrations.map((r) => [r.tenantId, r]));
  const overrides = await readTenantLifecycleOverrides(dataDir);
  const allowlist = await getTenantAllowlist();
  const strictAllowlist = isStrictTenantAllowlistEnabled();

  const rows = [];
  const totals = {
    tenants: 0,
    active: 0,
    trial: 0,
    trial_expired: 0,
    suspended: 0,
    missing_store: 0,
    readOnly: 0,
    allowlisted: 0,
    trialEnding7d: 0,
  };

  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    const reg = regByTenant.get(tenantId);
    const override = overrides[tenantId] ?? {};
    const businessName =
      String(store?.settings?.businessName ?? '').trim()
      || reg?.businessName
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    const plan = reg?.plan ?? store?.settings?.tenantMeta?.plan ?? null;
    const trialEndsAt = store?.settings?.tenantMeta?.trialEndsAt ?? null;
    const registrationEmail = reg?.email ?? store?.settings?.tenantMeta?.email ?? null;
    const createdAt = reg?.createdAt ?? store?.createdAt ?? null;
    const { status, reason } = computeLifecycleStatus({
      tenantId,
      store,
      plan,
      trialEndsAt,
      override,
    });
    const onAllowlist = await isTenantAllowlisted(tenantId);
    const daysLeft = daysUntil(trialEndsAt);

    totals.tenants += 1;
    totals[status] = (totals[status] ?? 0) + 1;
    if (override.readOnly) totals.readOnly += 1;
    if (onAllowlist) totals.allowlisted += 1;
    if (daysLeft != null && daysLeft >= 0 && daysLeft <= 7 && status === 'trial') {
      totals.trialEnding7d += 1;
    }

    const sales = Array.isArray(store?.sales) ? store.sales : [];
    const monthAgo = Date.now() - 30 * 86400000;
    let revenue30d = 0;
    for (const sale of sales) {
      const t = Date.parse(sale?.createdAt ?? sale?.date ?? '');
      if (!Number.isFinite(t) || t < monthAgo) continue;
      revenue30d += Number(sale?.total ?? sale?.grandTotal ?? 0) || 0;
    }

    rows.push({
      tenantId,
      businessName,
      label: tenantId === 'main' ? 'Greenleaf Market (main)' : tenantId,
      status,
      statusReason: reason,
      statusLabel: LIFECYCLE_STATUS_LABELS[status] ?? status,
      plan,
      productProfile: store?.settings?.productProfile ?? 'unknown',
      trialEndsAt,
      trialDaysLeft: daysLeft,
      registrationEmail,
      createdAt,
      updatedAt: store?.updatedAt ?? null,
      activeUserCount: (store?.users ?? []).filter((u) => u.isActive !== false).length,
      revenue30dTry: Math.round(revenue30d * 100) / 100,
      onAllowlist,
      suspended: override.suspended === true,
      readOnly: override.readOnly === true,
      opsNotes: String(override.opsNotes ?? '').trim(),
      postaOnboardingStatus: store?.settings?.postaOnboarding?.status ?? null,
    });
  }

  rows.sort((a, b) => {
    const order = { suspended: 0, trial_expired: 1, missing_store: 2, trial: 3, active: 4 };
    const da = order[a.status] ?? 9;
    const db = order[b.status] ?? 9;
    if (da !== db) return da - db;
    return a.businessName.localeCompare(b.businessName, 'tr');
  });

  return {
    generatedAt: new Date().toISOString(),
    config: {
      strictAllowlist,
      allowlist,
      publicRegistrationEnabled:
        String(process.env.EKOLOJIK_PUBLIC_REGISTER ?? '').trim() === '1'
        || process.env.NODE_ENV !== 'production',
    },
    totals,
    tenants: rows,
  };
}

async function patchRegistrationPlan(dataDir, tenantId, plan) {
  try {
    const path = join(dataDir, 'registrations.json');
    const list = JSON.parse(await readFile(path, 'utf8'));
    if (!Array.isArray(list)) return;
    const hit = list.find((r) => r.tenantId === tenantId);
    if (hit && plan) hit.plan = plan;
    await writeFile(path, JSON.stringify(list, null, 2), 'utf8');
  } catch {
    /* optional */
  }
}

export async function updatePlatformTenantLifecycle(dataDir, tenantId, patch, operatorUsername) {
  const id = normalizeTenantId(tenantId);
  if (!id) return { ok: false, error: 'Geçersiz kiracı' };

  const overrides = await readTenantLifecycleOverrides(dataDir);
  const prev = overrides[id] ?? {};
  const next = {
    ...prev,
    ...(patch.suspended !== undefined ? { suspended: patch.suspended === true } : {}),
    ...(patch.readOnly !== undefined ? { readOnly: patch.readOnly === true } : {}),
    ...(patch.opsNotes !== undefined ? { opsNotes: String(patch.opsNotes ?? '').slice(0, 4000) } : {}),
    updatedAt: new Date().toISOString(),
    updatedBy: String(operatorUsername ?? '').trim() || 'platform',
  };
  overrides[id] = next;
  await writeTenantLifecycleOverrides(dataDir, overrides);

  if (patch.plan !== undefined || patch.trialEndsAt !== undefined) {
    const store = await readTenantStore(dataDir, id);
    if (!store) {
      return { ok: false, error: 'Mağaza verisi bulunamadı' };
    }
    store.settings = store.settings ?? {};
    store.settings.tenantMeta = { ...(store.settings.tenantMeta ?? {}) };
    if (patch.plan !== undefined) {
      store.settings.tenantMeta.plan = String(patch.plan ?? '').trim() || 'trial';
      await patchRegistrationPlan(dataDir, id, store.settings.tenantMeta.plan);
    }
    if (patch.trialEndsAt !== undefined) {
      const raw = String(patch.trialEndsAt ?? '').trim();
      store.settings.tenantMeta.trialEndsAt = raw || null;
    }
    store.updatedAt = new Date().toISOString();
    await writeTenantStore(dataDir, id, store);
  }

  const overview = await buildPlatformTenantsLifecycle(dataDir);
  const row = overview.tenants.find((t) => t.tenantId === id);
  return { ok: true, tenant: row };
}
