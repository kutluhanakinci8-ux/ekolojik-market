import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { posHubFetch } from './posHubFetch';
import { posApiAuthHeaders } from './posApiAuth';

function tenantQuery(): string {
  const tenant = loadTenantId();
  if (!tenant || tenant === DEFAULT_TENANT_ID) return '';
  return `?tenant=${encodeURIComponent(tenant)}`;
}

export type PostaOnboardingStepState = {
  done: boolean;
  skipped: boolean;
  at: string | null;
};

export type PostaOnboardingState = {
  version: number;
  status: 'pending' | 'in_progress' | 'completed' | 'dismissed';
  startedAt: string | null;
  completedAt: string | null;
  steps: {
    mailHealth: PostaOnboardingStepState;
    messagingEmbed: PostaOnboardingStepState;
    postaTab: PostaOnboardingStepState;
  };
  registrationEmail: string;
  notes: string;
};

export type PostaOnboardingHub = {
  ok: boolean;
  onboarding: PostaOnboardingState;
  summary: {
    mailHealth: {
      smtpConfigured: boolean;
      smtpVerified: boolean;
      smtpError: string | null;
      imapConfigured: boolean;
    };
    messaging: {
      publicApiConfigured: boolean;
      apiPrefix: string;
    };
    postaTabGranted: boolean;
    primaryAdminUserId: string | null;
  };
};

export async function fetchPostaOnboardingHub(): Promise<PostaOnboardingHub | null> {
  const res = await posHubFetch(`/api/posta/onboarding${tenantQuery()}`);
  if (!res.ok) return null;
  return (await res.json()) as PostaOnboardingHub;
}

export async function patchPostaOnboarding(payload: {
  status?: PostaOnboardingState['status'];
  steps?: Partial<Record<'mailHealth' | 'messagingEmbed' | 'postaTab', { done?: boolean; skipped?: boolean }>>;
  notes?: string;
}): Promise<{ ok: boolean; onboarding?: PostaOnboardingState }> {
  const res = await posHubFetch(`/api/posta/onboarding${tenantQuery()}`, {
    method: 'PATCH',
    headers: posApiAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; onboarding?: PostaOnboardingState };
  return { ok: Boolean(res.ok && data.ok !== false), onboarding: data.onboarding };
}

export async function reopenPostaOnboarding(): Promise<{ ok: boolean; onboarding?: PostaOnboardingState }> {
  const res = await posHubFetch(`/api/posta/onboarding/reopen${tenantQuery()}`, {
    method: 'POST',
    headers: posApiAuthHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; onboarding?: PostaOnboardingState };
  return { ok: Boolean(res.ok && data.ok), onboarding: data.onboarding };
}

export async function seedPostaOnboardingAliasRules(): Promise<{ ok: boolean; added?: unknown[] }> {
  const res = await posHubFetch(`/api/posta/onboarding/seed-alias-rules${tenantQuery()}`, {
    method: 'POST',
    headers: posApiAuthHeaders(),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; added?: unknown[] };
  return { ok: Boolean(res.ok && data.ok), added: data.added };
}

export async function completePostaOnboarding(options?: {
  primaryOnly?: boolean;
  skipIncompleteSteps?: boolean;
}): Promise<{ ok: boolean; onboarding?: PostaOnboardingState; grantCount?: number }> {
  const res = await posHubFetch(`/api/posta/onboarding/complete${tenantQuery()}`, {
    method: 'POST',
    headers: posApiAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(options ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    onboarding?: PostaOnboardingState;
    grantCount?: number;
  };
  return {
    ok: Boolean(res.ok && data.ok),
    onboarding: data.onboarding,
    grantCount: data.grantCount,
  };
}

export type MessagingPublicConfigHub = {
  ok: boolean;
  tenantId: string;
  enabled: boolean;
  hasTenantKey: boolean;
  publicKey: string;
  publicKeyMasked: string;
  effectiveSource: 'tenant' | 'env' | null;
  configured: boolean;
  rotatedAt: string | null;
  apiPrefix: string;
  authHeader: string;
};

export async function fetchMessagingPublicConfig(): Promise<MessagingPublicConfigHub | null> {
  const res = await posHubFetch(`/api/messaging/public-config${tenantQuery()}`);
  if (!res.ok) return null;
  return (await res.json()) as MessagingPublicConfigHub;
}

export async function rotateMessagingPublicKey(): Promise<MessagingPublicConfigHub | null> {
  const res = await posHubFetch(`/api/messaging/public-config${tenantQuery()}`, {
    method: 'POST',
    headers: posApiAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ rotate: true }),
  });
  if (!res.ok) return null;
  return (await res.json()) as MessagingPublicConfigHub;
}

export function buildMessagingEmbedSnippet(tenantId: string, apiKey: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://ekolojikmarket.com.tr';
  const key = apiKey || 'API_ANAHTARI';
  const tenantQs = tenantId && tenantId !== 'main' ? `?tenant=${encodeURIComponent(tenantId)}` : '';
  return `<!-- Ekolojik müşteri mesajlaşma -->
<script>
  window.EkolojikMessaging = {
    tenantId: '${tenantId}',
    apiBase: '${origin}/api/public/messaging/v1',
    apiKey: '${key}',
    tenantQuery: '${tenantQs}'
  };
</script>`;
}
