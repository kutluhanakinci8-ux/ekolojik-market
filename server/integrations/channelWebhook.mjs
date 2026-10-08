import { handleWhatsAppWebhook } from './whatsappCloud.mjs';

/** @type {Map<string, (ctx: object) => Promise<object>>} */
const adapters = new Map();

function registerDefaults() {
  if (adapters.size) return;
  adapters.set('whatsapp', async (ctx) =>
    handleWhatsAppWebhook(ctx.dataDir, ctx.tenantId, {
      method: ctx.method,
      query: ctx.query,
      body: ctx.body,
    }),
  );
}

export function listChannelWebhookIds() {
  registerDefaults();
  return [...adapters.keys()];
}

export async function handleChannelWebhook(channelId, ctx) {
  registerDefaults();
  const handler = adapters.get(String(channelId || '').trim().toLowerCase());
  if (!handler) {
    return { ok: false, status: 404, error: `Bilinmeyen kanal: ${channelId}` };
  }
  return handler(ctx);
}
