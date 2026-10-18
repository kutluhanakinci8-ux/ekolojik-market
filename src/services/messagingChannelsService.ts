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
  sms?: {
    enabled: boolean;
    configured: boolean;
    webhookPath: string;
    webhookUrlHint: string;
    inboundSecretSet: boolean;
  };
  instagram?: {
    enabled: boolean;
    configured: boolean;
    webhookPath: string;
    webhookUrlHint: string;
    inboundSecretSet: boolean;
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
  sms?: { enabled?: boolean };
  instagram?: { enabled?: boolean };
}): Promise<MessagingChannelsHub> {
  const res = await posHubFetch('/api/messaging/channels', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.json();
}
