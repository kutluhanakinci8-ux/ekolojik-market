import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function configPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'messaging', tenantId, 'channels.json');
}

async function readRaw(dataDir, tenantId) {
  try {
    return JSON.parse(await readFile(configPath(dataDir, tenantId), 'utf8'));
  } catch {
    return {};
  }
}

export function isWhatsAppEnvConfigured() {
  const token = process.env.EKOLOJIK_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.EKOLOJIK_WHATSAPP_PHONE_NUMBER_ID?.trim();
  return Boolean(token && phoneId);
}

export async function getMessagingChannelsHub(dataDir, tenantId = 'main') {
  const raw = await readRaw(dataDir, tenantId);
  const wa = raw.whatsapp ?? {};
  const envOk = isWhatsAppEnvConfigured();
  const verifyToken =
    String(wa.verifyToken ?? '').trim() || process.env.EKOLOJIK_WHATSAPP_VERIFY_TOKEN?.trim() || '';
  return {
    ok: true,
    tenantId,
    whatsapp: {
      enabled: Boolean(wa.enabled) && envOk,
      configured: envOk,
      phoneNumberId: process.env.EKOLOJIK_WHATSAPP_PHONE_NUMBER_ID?.trim() || null,
      displayPhone: String(wa.displayPhone ?? '').trim() || null,
      verifyTokenSet: Boolean(verifyToken),
      webhookPath: '/api/webhooks/messaging/whatsapp',
      webhookUrlHint: `?tenant=${encodeURIComponent(tenantId)}`,
    },
    channels: [
      { id: 'web', label: 'Web widget', status: 'active' },
      {
        id: 'whatsapp',
        label: 'WhatsApp Cloud',
        status: wa.enabled && envOk ? 'active' : envOk ? 'disabled' : 'needs_env',
      },
    ],
  };
}

export async function saveMessagingChannelsHub(dataDir, tenantId, patch = {}) {
  const current = await readRaw(dataDir, tenantId);
  const wa = { ...(current.whatsapp ?? {}) };
  if (patch.whatsapp) {
    if (patch.whatsapp.enabled != null) wa.enabled = Boolean(patch.whatsapp.enabled);
    if (patch.whatsapp.displayPhone != null) {
      wa.displayPhone = String(patch.whatsapp.displayPhone ?? '').trim() || null;
    }
    if (patch.whatsapp.verifyToken != null) {
      wa.verifyToken = String(patch.whatsapp.verifyToken ?? '').trim() || null;
    }
  }
  wa.updatedAt = new Date().toISOString();
  const next = { ...current, whatsapp: wa };
  await mkdir(join(dataDir, 'messaging', tenantId), { recursive: true });
  await writeFile(configPath(dataDir, tenantId), JSON.stringify(next, null, 2), 'utf8');
  return getMessagingChannelsHub(dataDir, tenantId);
}

export async function resolveWhatsAppVerifyToken(dataDir, tenantId) {
  const raw = await readRaw(dataDir, tenantId);
  return (
    String(raw.whatsapp?.verifyToken ?? '').trim() ||
    process.env.EKOLOJIK_WHATSAPP_VERIFY_TOKEN?.trim() ||
    ''
  );
}

export async function isWhatsAppChannelEnabled(dataDir, tenantId) {
  const hub = await getMessagingChannelsHub(dataDir, tenantId);
  return Boolean(hub.whatsapp?.enabled);
}
