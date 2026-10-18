import { posHubFetch } from './posHubFetch';

export type PostaEnterpriseCapabilities = {
  ok: boolean;
  overallPercent: number;
  scores: Record<string, number>;
  surfaces?: Record<string, string>;
  notes?: Record<string, string>;
};

export type PostaDelegateRow = {
  userId: string;
  displayName: string;
  role: 'read' | 'send' | 'full';
  sendAs: string[];
};

export type PostaMarketingCampaign = {
  id: string;
  name: string;
  subject: string;
  bodyText: string;
  segmentTag: string | null;
  status: string;
  variantB?: { subject: string; bodyText: string } | null;
};

export async function fetchPostaEnterpriseCapabilities() {
  const res = await posHubFetch('/api/posta/enterprise/capabilities');
  return res.json() as Promise<PostaEnterpriseCapabilities>;
}

export async function fetchPostaDelegates() {
  const res = await posHubFetch('/api/posta/delegates');
  return res.json() as Promise<{
    ok: boolean;
    delegates: PostaDelegateRow[];
    sendAsAliases: string[];
  }>;
}

export async function savePostaDelegates(payload: {
  delegates: PostaDelegateRow[];
  sendAsAliases?: string[];
}) {
  const res = await posHubFetch('/api/posta/delegates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchPostaMarketingCampaigns() {
  const res = await posHubFetch('/api/posta/marketing/campaigns');
  return res.json() as Promise<{ ok: boolean; campaigns: PostaMarketingCampaign[] }>;
}

export async function upsertPostaMarketingCampaign(payload: Partial<PostaMarketingCampaign>) {
  const res = await posHubFetch('/api/posta/marketing/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function runPostaMarketingCampaign(campaignId: string, limit = 200) {
  const res = await posHubFetch('/api/posta/marketing/campaigns/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignId, limit }),
  });
  return res.json();
}

export async function fetchPostaComplianceArchive(limit = 200) {
  const res = await posHubFetch(`/api/posta/compliance/archive?limit=${limit}`);
  return res.json();
}

export async function setPostaLegalHold(messageIds: string[], hold = true) {
  const res = await posHubFetch('/api/posta/compliance/legal-hold', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageIds, hold }),
  });
  return res.json();
}
