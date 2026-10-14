/** Pazarlama otomasyonu (lite) — kampanya, segment, toplu outbox */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { listPostaContacts } from './postaContacts.mjs';
import { enqueueEkolojikMail } from './emailOutbox.mjs';

function campaignsPath(dataDir, tenantId) {
  return join(dataDir, 'posta-marketing', tenantId, 'campaigns.json');
}

async function readCampaigns(dataDir, tenantId) {
  try {
    const raw = JSON.parse(await readFile(campaignsPath(dataDir, tenantId), 'utf8'));
    return Array.isArray(raw.campaigns) ? raw.campaigns : [];
  } catch {
    return [];
  }
}

async function writeCampaigns(dataDir, tenantId, campaigns) {
  await mkdir(join(dataDir, 'posta-marketing', tenantId), { recursive: true });
  await writeFile(campaignsPath(dataDir, tenantId), JSON.stringify({ campaigns }, null, 2), 'utf8');
}

export async function listPostaMarketingCampaigns(dataDir, tenantId) {
  const campaigns = await readCampaigns(dataDir, tenantId);
  return { ok: true, campaigns, espLevel: 'lite', abTesting: true };
}

export async function upsertPostaMarketingCampaign(dataDir, tenantId, payload) {
  const campaigns = await readCampaigns(dataDir, tenantId);
  const id = String(payload?.id ?? `cmp-${randomUUID()}`).trim();
  const row = {
    id,
    name: String(payload?.name ?? 'Kampanya').trim(),
    subject: String(payload?.subject ?? '').trim(),
    bodyText: String(payload?.bodyText ?? payload?.body ?? '').trim(),
    segmentTag: String(payload?.segmentTag ?? '').trim() || null,
    status: String(payload?.status ?? 'draft').trim(),
    variantB: payload?.variantB
      ? {
          subject: String(payload.variantB.subject ?? '').trim(),
          bodyText: String(payload.variantB.bodyText ?? '').trim(),
        }
      : null,
    updatedAt: new Date().toISOString(),
  };
  const idx = campaigns.findIndex((c) => c.id === id);
  if (idx >= 0) campaigns[idx] = { ...campaigns[idx], ...row };
  else campaigns.unshift(row);
  await writeCampaigns(dataDir, tenantId, campaigns);
  return { ok: true, campaign: row };
}

function pickAbVariant(campaign, index) {
  if (!campaign.variantB?.subject) return campaign;
  return index % 2 === 0 ? campaign : { ...campaign, subject: campaign.variantB.subject, bodyText: campaign.variantB.bodyText || campaign.bodyText };
}

export async function runPostaMarketingCampaign(dataDir, tenantId, campaignId, { limit = 200 } = {}) {
  const campaigns = await readCampaigns(dataDir, tenantId);
  const campaign = campaigns.find((c) => c.id === campaignId);
  if (!campaign) return { ok: false, error: 'Kampanya bulunamadı' };
  if (!campaign.subject || !campaign.bodyText) {
    return { ok: false, error: 'Konu ve metin gerekli' };
  }

  const contacts = await listPostaContacts(dataDir, tenantId, { limit: 500 });
  let recipients = (contacts.contacts ?? []).filter((c) => c.email?.includes('@'));
  if (campaign.segmentTag) {
    const tag = campaign.segmentTag.toLowerCase();
    recipients = recipients.filter(
      (c) => (c.tags ?? []).some((t) => String(t).toLowerCase() === tag) || String(c.notes ?? '').toLowerCase().includes(tag),
    );
  }
  recipients = recipients.slice(0, Math.min(limit, 500));

  let enqueued = 0;
  for (let i = 0; i < recipients.length; i += 1) {
    const c = recipients[i];
    const variant = pickAbVariant(campaign, i);
    await enqueueEkolojikMail(dataDir, {
      to: c.email,
      subject: variant.subject,
      text: variant.bodyText,
      tenantId,
      source: 'posta-campaign',
      idempotencyKey: `campaign:${campaignId}:${c.id}`,
    });
    enqueued += 1;
  }

  campaign.status = 'sent';
  campaign.lastRunAt = new Date().toISOString();
  campaign.lastEnqueued = enqueued;
  await writeCampaigns(dataDir, tenantId, campaigns);
  return { ok: true, enqueued, abTesting: Boolean(campaign.variantB) };
}
