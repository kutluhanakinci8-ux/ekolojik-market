import { isEkolojikSmtpConfigured } from './ekolojikMailConfig.mjs';
import { isTenantImapConfigured, getTenantSmtpMailConfig } from './tenantMailConfig.mjs';
import { verifyEkolojikSmtp } from './ekolojikSmtp.mjs';
import { isMessagingPublicApiConfigured } from './messaging/publicConfig.mjs';

export const POSTA_ONBOARDING_VERSION = 1;

const STEP_IDS = ['mailHealth', 'messagingEmbed', 'postaTab'];

export function createDefaultPostaOnboarding(registrationEmail = '') {
  const emptyStep = () => ({ done: false, skipped: false, at: null });
  return {
    version: POSTA_ONBOARDING_VERSION,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    steps: {
      mailHealth: emptyStep(),
      messagingEmbed: emptyStep(),
      postaTab: emptyStep(),
    },
    registrationEmail: String(registrationEmail ?? '').trim().toLowerCase(),
    notes: '',
  };
}

export function ensurePostaOnboarding(settings, registrationEmail) {
  const base = settings?.postaOnboarding;
  if (!base || typeof base !== 'object') {
    return createDefaultPostaOnboarding(registrationEmail ?? settings?.tenantMeta?.email ?? '');
  }
  const defaults = createDefaultPostaOnboarding();
  const steps = { ...defaults.steps };
  for (const id of STEP_IDS) {
    const s = base.steps?.[id];
    steps[id] = {
      done: Boolean(s?.done),
      skipped: Boolean(s?.skipped),
      at: s?.at ?? null,
    };
  }
  return {
    version: POSTA_ONBOARDING_VERSION,
    status: base.status ?? 'pending',
    startedAt: base.startedAt ?? null,
    completedAt: base.completedAt ?? null,
    steps,
    registrationEmail:
      String(base.registrationEmail ?? registrationEmail ?? settings?.tenantMeta?.email ?? '').trim().toLowerCase(),
    notes: String(base.notes ?? ''),
  };
}

async function buildMailHealthSummary(dataDir, tenantId) {
  const mailCfg = await getTenantSmtpMailConfig(dataDir, tenantId);
  const smtpConfigured = Boolean(mailCfg.smtpHost && mailCfg.from?.includes('@'));
  const verify = smtpConfigured ? await verifyEkolojikSmtp() : { ok: false, error: 'SMTP yapılandırılmadı' };
  const imapConfigured = await isTenantImapConfigured(dataDir, tenantId);
  return {
    smtpConfigured,
    smtpVerified: Boolean(verify.ok),
    smtpError: verify.error ?? null,
    imapConfigured,
  };
}

function findPrimaryAdmin(users) {
  if (!Array.isArray(users)) return null;
  return users.find((u) => u.isPrimaryAdmin && u.isActive !== false) ?? users.find((u) => u.role === 'admin' && u.isActive !== false) ?? null;
}

export async function getPostaOnboardingHub(dataDir, tenantId, store) {
  const settings = store?.settings ?? {};
  const onboarding = ensurePostaOnboarding(settings);
  const mailHealth = await buildMailHealthSummary(dataDir, tenantId);
  const publicApiConfigured = await isMessagingPublicApiConfigured(dataDir, tenantId);
  const users = Array.isArray(store?.users) ? store.users : [];
  const primaryAdmin = findPrimaryAdmin(users);
  const postaTabGranted = users.some((u) => u.isActive !== false && u.allowedTabs?.includes('posta'));

  return {
    ok: true,
    onboarding,
    summary: {
      mailHealth,
      messaging: {
        publicApiConfigured,
        apiPrefix: '/api/public/messaging/v1',
      },
      postaTabGranted,
      primaryAdminUserId: primaryAdmin?.id ?? null,
    },
  };
}

function stampStep(step, { done, skipped }) {
  const now = new Date().toISOString();
  if (done) return { done: true, skipped: false, at: now };
  if (skipped) return { done: false, skipped: true, at: now };
  return {
    done: Boolean(step?.done),
    skipped: Boolean(step?.skipped),
    at: step?.at ?? null,
  };
}

export function patchPostaOnboardingState(store, payload) {
  const settings = store?.settings ?? {};
  const current = ensurePostaOnboarding(settings);
  const steps = { ...current.steps };
  const now = new Date().toISOString();

  if (payload?.steps && typeof payload.steps === 'object') {
    for (const id of STEP_IDS) {
      const patch = payload.steps[id];
      if (!patch) continue;
      steps[id] = stampStep(steps[id], {
        done: patch.done === true,
        skipped: patch.skipped === true,
      });
    }
  }

  let status = current.status;
  if (payload?.status && ['pending', 'in_progress', 'completed', 'dismissed'].includes(payload.status)) {
    status = payload.status;
  }
  if (status === 'pending' && (payload?.steps || payload?.status === 'in_progress')) {
    status = 'in_progress';
  }

  const startedAt = current.startedAt || (status === 'in_progress' ? now : null);

  const onboarding = {
    ...current,
    status,
    startedAt,
    completedAt: current.completedAt,
    steps,
    notes: payload?.notes !== undefined ? String(payload.notes ?? '') : current.notes,
  };

  return {
    settings: {
      ...settings,
      postaOnboarding: onboarding,
    },
    onboarding,
  };
}

/** @param {{ primaryOnly?: boolean, userIds?: string[] }} options */
export function grantPostaTabToUsers(store, options = {}) {
  const users = Array.isArray(store?.users) ? store.users : [];
  const ids = new Set((options.userIds ?? []).map((id) => String(id)));
  const primaryOnly = options.primaryOnly !== false;
  const primary = findPrimaryAdmin(users);
  const now = new Date().toISOString();
  let changed = 0;

  const nextUsers = users.map((user) => {
    let shouldGrant = false;
    if (ids.size > 0) {
      shouldGrant = ids.has(user.id);
    } else if (primaryOnly) {
      shouldGrant = primary ? user.id === primary.id : user.role === 'admin';
    } else {
      shouldGrant = user.role === 'admin';
    }

    if (!shouldGrant || user.isActive === false) return user;
    const tabs = Array.isArray(user.allowedTabs) ? [...user.allowedTabs] : [];
    if (tabs.includes('posta')) return user;
    changed += 1;
    return { ...user, allowedTabs: [...tabs, 'posta'], updatedAt: now };
  });

  return { users: nextUsers, changed };
}

export function completePostaOnboarding(store, options = {}) {
  const prev = ensurePostaOnboarding(store?.settings);
  const stepPatch = {};
  if (!prev.steps.mailHealth.done && !prev.steps.mailHealth.skipped && options.skipIncompleteSteps) {
    stepPatch.mailHealth = { skipped: true };
  }
  if (!prev.steps.messagingEmbed.done && !prev.steps.messagingEmbed.skipped && options.skipIncompleteSteps) {
    stepPatch.messagingEmbed = { skipped: true };
  }
  stepPatch.postaTab = { done: true };

  const { settings: midSettings } = patchPostaOnboardingState(store, {
    status: 'in_progress',
    steps: stepPatch,
  });

  const grant = grantPostaTabToUsers(
    { ...store, settings: midSettings },
    {
      primaryOnly: options.primaryOnly !== false,
      userIds: Array.isArray(options.userIds) ? options.userIds : [],
    },
  );

  const completedAt = new Date().toISOString();
  const onboarding = ensurePostaOnboarding({
    ...midSettings,
    postaOnboarding: {
      ...ensurePostaOnboarding(midSettings),
      status: 'completed',
      completedAt,
      steps: {
        ...ensurePostaOnboarding(midSettings).steps,
        postaTab: { done: true, skipped: false, at: completedAt },
      },
    },
  });

  return {
    settings: {
      ...midSettings,
      postaOnboarding: onboarding,
    },
    users: grant.users,
    grantCount: grant.changed,
    onboarding,
  };
}

/**
 * Mevcut mağazalar (Faz 3): tüm adminlere posta sekmesi + onboarding tamamlandı.
 * Yeni kayıtlar (registrationEmail dolu, henüz tamamlanmamış) otomatik tamamlanmaz — sihirbaz kalır.
 */
/** Ayarlar → kurulumu yeniden aç (adımlar korunur, completedAt sıfırlanır). */
export function reopenPostaOnboardingState(store) {
  const settings = { ...(store?.settings ?? {}) };
  const current = ensurePostaOnboarding(settings);
  const now = new Date().toISOString();
  settings.postaOnboarding = {
    ...current,
    status: 'in_progress',
    startedAt: current.startedAt || now,
    completedAt: null,
    notes: current.notes,
  };
  return {
    store: { ...store, settings, updatedAt: now },
    onboarding: settings.postaOnboarding,
  };
}

export function migrateLegacyPostaOnboarding(store) {
  if (!store || typeof store !== 'object') {
    return { store, changed: false };
  }

  const settings = { ...(store.settings ?? {}) };
  let users = Array.isArray(store.users) ? store.users : [];
  let changed = false;

  const applyGrant = (primaryOnly) => {
    const grant = grantPostaTabToUsers({ ...store, settings, users }, { primaryOnly });
    if (grant.changed) {
      users = grant.users;
      changed = true;
    }
  };

  if (settings.postaOnboardingLegacyMigratedAt) {
    applyGrant(false);
    if (!changed) return { store, changed: false };
    return { store: { ...store, settings, users, updatedAt: new Date().toISOString() }, changed: true };
  }

  const onboarding = settings.postaOnboarding;
  const regEmail = String(onboarding?.registrationEmail ?? '').trim();
  const isNewTenantInWizard =
    Boolean(regEmail) && onboarding?.status !== 'completed' && onboarding?.status !== 'dismissed';

  if (isNewTenantInWizard) {
    applyGrant(true);
    if (!changed) return { store, changed: false };
    return { store: { ...store, settings, users, updatedAt: new Date().toISOString() }, changed: true };
  }

  applyGrant(false);

  const completedAt = new Date().toISOString();
  const mergedOnboarding = ensurePostaOnboarding(settings, settings.tenantMeta?.email);
  settings.postaOnboarding = {
    ...mergedOnboarding,
    status: 'completed',
    startedAt: mergedOnboarding.startedAt || completedAt,
    completedAt,
    migratedFromLegacy: true,
    notes: mergedOnboarding.notes || 'Otomatik migrasyon (mevcut mağaza)',
    steps: {
      mailHealth: { done: true, skipped: false, at: completedAt },
      messagingEmbed: { done: false, skipped: true, at: completedAt },
      postaTab: { done: true, skipped: false, at: completedAt },
    },
  };
  settings.postaOnboardingLegacyMigratedAt = completedAt;
  changed = true;

  return {
    store: { ...store, settings, users, updatedAt: completedAt },
    changed: true,
  };
}
