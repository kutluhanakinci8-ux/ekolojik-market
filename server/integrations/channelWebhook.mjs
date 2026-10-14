import { handleWhatsAppWebhook } from './whatsappCloud.mjs';
import { handleSmsInboundWebhook } from './smsInbound.mjs';
import { handleInstagramInboundWebhook } from './instagramInbound.mjs';

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
  adapters.set('sms', async (ctx) =>
    handleSmsInboundWebhook(ctx.dataDir, ctx.tenantId, {
      method: ctx.method,
      body: ctx.body,
      req: ctx.req,
    }),
  );
  adapters.set('instagram', async (ctx) =>
    handleInstagramInboundWebhook(ctx.dataDir, ctx.tenantId, {
      method: ctx.method,
      body: ctx.body,
      req: ctx.req,
      query: ctx.query,
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
