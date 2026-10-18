import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPostaAiRuntimeConfig } from './aiConfig.mjs';

function configPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'messaging', tenantId, 'bot.json');
}

async function readRaw(dataDir, tenantId) {
  try {
    return JSON.parse(await readFile(configPath(dataDir, tenantId), 'utf8'));
  } catch {
    return {};
  }
}

export function isMessagingBotEnvEnabled() {
  const v = String(process.env.EKOLOJIK_MESSAGING_BOT ?? '1').trim();
  return v !== '0' && v.toLowerCase() !== 'false';
}

export async function getMessagingBotHub(dataDir, tenantId = 'main') {
  const raw = await readRaw(dataDir, tenantId);
  const envOn = isMessagingBotEnvEnabled();
  const enabled = raw.enabled != null ? Boolean(raw.enabled) : envOn;
  return {
    ok: true,
    tenantId,
    bot: {
      enabled: enabled && envOn,
      envEnabled: envOn,
      handoffKeywords: raw.handoffKeywords ?? null,
    },
    ai: getPostaAiRuntimeConfig(),
  };
}

export async function saveMessagingBotHub(dataDir, tenantId, patch = {}) {
  const current = await readRaw(dataDir, tenantId);
  const next = { ...current };
  if (patch.enabled != null) next.enabled = Boolean(patch.enabled);
  if (Array.isArray(patch.handoffKeywords)) {
    next.handoffKeywords = patch.handoffKeywords.map((k) => String(k).trim()).filter(Boolean);
  }
  next.updatedAt = new Date().toISOString();
  await mkdir(join(dataDir, 'messaging', tenantId), { recursive: true });
  await writeFile(configPath(dataDir, tenantId), JSON.stringify(next, null, 2), 'utf8');
  return getMessagingBotHub(dataDir, tenantId);
}
