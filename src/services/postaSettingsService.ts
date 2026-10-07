export type PostaNotificationPrefs = {
  contactOpsEmail: boolean;
  messagingOpsEmail: boolean;
  billEmailOpsEmail: boolean;
};

export type PostaNotificationChannelId = 'opsEmail' | 'inAppHub' | 'customerAutoreply';
export type PostaNotificationEventId = 'contact' | 'messaging' | 'bill' | 'outbox_failed';

export type PostaNotificationMatrix = Record<
  PostaNotificationEventId,
  Partial<Record<PostaNotificationChannelId, boolean>>
>;

export type PostaNotificationMatrixHub = {
  ok: boolean;
  catalog?: {
    events: { id: PostaNotificationEventId; label: string }[];
    channels: { id: PostaNotificationChannelId; label: string; eventIds: string[] | null }[];
  };
  matrix?: PostaNotificationMatrix;
  error?: string;
};

export type PostaMailSettings = {
  fromName: string | null;
  replyTo: string | null;
  opsEmail: string | null;
  signatureHtml: string;
  notifications: PostaNotificationPrefs;
  notificationMatrix?: PostaNotificationMatrix;
  updatedAt: string | null;
};

export type PostaEffectiveMail = {
  smtpHost: string;
  from: string;
  fromName: string;
  replyTo: string;
  opsEmail: string;
  signatureHtml: string;
  notifications: PostaNotificationPrefs;
  notificationMatrix?: PostaNotificationMatrix;
  envFromName: string;
  envReplyTo: string;
  envOpsEmail: string;
};

export async function fetchPostaMailSettings(): Promise<{
  ok: boolean;
  settings?: PostaMailSettings;
  effective?: PostaEffectiveMail;
  error?: string;
}> {
  const res = await fetch('/api/posta/settings');
  return res.json();
}

export async function savePostaMailSettings(
  patch: Partial<PostaMailSettings> & {
    notifications?: Partial<PostaNotificationPrefs>;
    notificationMatrix?: PostaNotificationMatrix;
  },
): Promise<{
  ok: boolean;
  settings?: PostaMailSettings;
  error?: string;
}> {
  const res = await fetch('/api/posta/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.json();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadPostaOutboxCsv(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from?.trim()) params.set('from', from.trim());
  if (to?.trim()) params.set('to', to.trim());
  const qs = params.toString();
  const res = await fetch(`/api/posta/export/outbox.csv${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Outbox export başarısız');
  }
  const blob = await res.blob();
  downloadBlob(blob, 'ekolojik-outbox.csv');
}

export async function downloadPostaContactCsv(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from?.trim()) params.set('from', from.trim());
  if (to?.trim()) params.set('to', to.trim());
  const qs = params.toString();
  const res = await fetch(`/api/posta/export/contact.csv${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'İletişim export başarısız');
  }
  const blob = await res.blob();
  downloadBlob(blob, 'ekolojik-contact.csv');
}

export type PostaInboxRule = {
  id: string;
  enabled: boolean;
  name: string;
  subjectContains: string;
  fromContains: string;
  routeToFatura: boolean;
  label: string | null;
};

export type PostaOutboxAnalytics = {
  ok: boolean;
  windowDays?: number;
  counts?: { pending: number; sent: number; failed: number };
  window?: {
    sent: number;
    failed: number;
    attempted: number;
    successRatePercent: number | null;
  };
  byDay?: { date: string; sent: number; failed: number }[];
  recentErrors?: { id: string; to: string; subject: string; at?: string; error?: string }[];
  mailTrackEnabled?: boolean;
  error?: string;
};

export type PostaDeliverabilityHub = {
  ok: boolean;
  domain?: string;
  primaryFrom?: string;
  fromName?: string;
  replyTo?: string;
  opsEmail?: string;
  aliases?: string[];
  smtp?: { configured: boolean; verified: boolean; host: string | null; error?: string | null };
  dns?: {
    spf: { status: string; value: string | null };
    dmarc: { status: string; value: string | null };
    dkim: { status: string; value: string | null };
    selector?: string;
  };
  suggestedRecords?: { spf: string; dmarc: string; dkimHint: string };
  error?: string;
};

export async function fetchPostaDeliverability(): Promise<PostaDeliverabilityHub> {
  const res = await fetch('/api/posta/deliverability');
  return res.json();
}

export async function fetchPostaNotificationsMatrix(): Promise<PostaNotificationMatrixHub> {
  const res = await fetch('/api/posta/notifications/matrix');
  return res.json();
}

export async function fetchPostaOutboxAnalytics(days = 14): Promise<PostaOutboxAnalytics> {
  const res = await fetch(`/api/posta/outbox/analytics?days=${days}`);
  return res.json();
}

export async function fetchPostaRules(): Promise<{ ok: boolean; rules?: PostaInboxRule[]; error?: string }> {
  const res = await fetch('/api/posta/rules');
  return res.json();
}

export async function savePostaInboxRules(
  rules: PostaInboxRule[],
): Promise<{ ok: boolean; rules?: PostaInboxRule[]; error?: string }> {
  const res = await fetch('/api/posta/rules', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules }),
  });
  return res.json();
}

export async function fetchPostaAiSuggest(payload: {
  subject?: string;
  body?: string;
  tone?: string;
}): Promise<{ ok: boolean; suggestion?: string; provider?: string; error?: string; aiEnabled?: boolean }> {
  const res = await fetch('/api/posta/compose/ai-suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function downloadMessagingExportZip() {
  const res = await fetch('/api/messaging/export');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Mesaj export başarısız');
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? 'ekolojik-messaging-export.zip';
  const blob = await res.blob();
  downloadBlob(blob, filename);
}
