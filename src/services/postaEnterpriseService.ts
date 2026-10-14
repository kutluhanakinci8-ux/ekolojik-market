import { posHubFetch } from './posHubFetch';

export type PostaEnterpriseCapabilities = {
  ok: boolean;
  overallPercent: number;
  scores: Record<string, number>;
  surfaces?: Record<string, string>;
  notes?: Record<string, string>;
};

export async function fetchPostaEnterpriseCapabilities() {
  const res = await posHubFetch('/api/posta/enterprise/capabilities');
  return res.json() as Promise<PostaEnterpriseCapabilities>;
}

export async function fetchPostaDelegates() {
  const res = await posHubFetch('/api/posta/delegates');
  return res.json();
}

export async function savePostaDelegates(payload: unknown) {
  const res = await posHubFetch('/api/posta/delegates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  return res.json();
}

export async function fetchPostaMarketingCampaigns() {
  const res = await posHubFetch('/api/posta/marketing/campaigns');
  return res.json();
}
