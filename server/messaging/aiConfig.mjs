/** Posta AI ve mesaj botu için ortak ortam değişkenleri (postaAiCompose ile uyumlu). */
export function isPostaAiEnabled() {
  return String(process.env.EKOLOJIK_POSTA_AI ?? '').trim() === '1';
}

export function getPostaAiRuntimeConfig() {
  const apiUrl = String(process.env.EKOLOJIK_POSTA_AI_URL ?? '').trim();
  const apiKey = String(process.env.EKOLOJIK_POSTA_AI_KEY ?? '').trim();
  const model = String(process.env.EKOLOJIK_POSTA_AI_MODEL ?? '').trim() || 'gpt-4o-mini';
  return {
    enabled: isPostaAiEnabled(),
    provider: apiUrl && apiKey ? 'external' : 'local-template',
    apiUrl: apiUrl || null,
    hasApiKey: Boolean(apiKey),
    model,
  };
}
