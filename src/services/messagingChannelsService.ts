import { posHubFetch } from './posHubFetch';

export type MessagingChannelsHub = {
  ok: boolean;
  tenantId?: string;
  whatsapp?: {
    enabled: boolean;
    configured: boolean;
    phoneNumberId: string | null;
    displayPhone: string | null;
    verifyTokenSet: boolean;
    webhookPath: string;
    webhookUrlHint: string;
  };
  channels?: { id: string; label: string; status: string }[];
  error?: string;
};

export async function fetchMessagingChannelsHub(): Promise<MessagingChannelsHub> {
  const res = await posHubFetch('/api/messaging/channels');
  return res.json();
}

export async function saveMessagingChannelsHub(patch: {
  whatsapp?: { enabled?: boolean; displayPhone?: string | null; verifyToken?: string | null };
}): Promise<MessagingChannelsHub> {
  const res = await posHubFetch('/api/messaging/channels', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.json();
}
