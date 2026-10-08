import { isPostaAiEnabled, getPostaAiRuntimeConfig } from './messaging/aiConfig.mjs';

export { isPostaAiEnabled, getPostaAiRuntimeConfig };

function localSuggest({ subject, body, tone }) {
  const subj = String(subject ?? '').trim();
  const text = String(body ?? '').trim();
  const t = String(tone ?? 'profesyonel').toLowerCase();
  const greeting = t === 'samimi' ? 'Merhaba,' : 'Sayın ilgili,';
  const closing = t === 'samimi' ? 'Sevgiler,' : 'Saygılarımızla,';
  const topic = subj || 'talebiniz';
  const suggestion = `${greeting}\n\n${topic} hakkında yazışmamıza istinaden${text ? ` (${text.slice(0, 120)}${text.length > 120 ? '…' : ''})` : ''} bilgilendirmek isteriz.\n\n[Detayı buraya ekleyin]\n\n${closing}\nEkolojik Market`;
  return {
    ok: true,
    provider: 'local-template',
    suggestion,
    subject: subj || 'Bilgilendirme',
  };
}

export async function suggestPostaCompose({ subject, body, tone }) {
  if (!isPostaAiEnabled()) {
    return { ok: false, error: 'EKOLOJIK_POSTA_AI=1 gerekli' };
  }

  const apiUrl = String(process.env.EKOLOJIK_POSTA_AI_URL ?? '').trim();
  const apiKey = String(process.env.EKOLOJIK_POSTA_AI_KEY ?? '').trim();

  if (!apiUrl || !apiKey) {
    return localSuggest({ subject, body, tone });
  }

  const prompt = `Türkçe, ${tone || 'profesyonel'} tonlu bir iş e-postası gövdesi yaz. Konu: ${subject || '(belirtilmedi)'}. Mevcut not: ${body || '(yok)'}. Sadece gövde metnini ver.`;

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.EKOLOJIK_POSTA_AI_MODEL || 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: `AI HTTP ${res.status}: ${errText.slice(0, 200)}` };
    }
    const data = await res.json();
    const suggestion =
      data.choices?.[0]?.message?.content?.trim() ||
      data.output?.trim() ||
      data.text?.trim();
    if (!suggestion) {
      return localSuggest({ subject, body, tone });
    }
    return { ok: true, provider: 'external', suggestion, subject: subject || 'Yanıt' };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'AI isteği başarısız',
      fallback: localSuggest({ subject, body, tone }),
    };
  }
}
