/** Destek D6 — case özet ve yanıt taslağı (TR); EKOLOJIK_POSTA_AI ile harici model */

import { isPostaAiEnabled, getPostaAiRuntimeConfig } from './messaging/aiConfig.mjs';
import { getPlatformSupportCaseDetail } from './platformSupportCaseOmni.mjs';

function clip(s, max = 400) {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function buildContextText(detail) {
  const c = detail.case;
  const lines = [
    `Konu: ${c.subject}`,
    `Kanal: ${c.channel}`,
    `Durum: ${c.status}`,
    `Talep eden: ${c.requesterName ?? ''} ${c.requesterEmail ?? ''}`.trim(),
    `Kiracı: ${c.businessName ?? c.tenantId ?? '—'}`,
  ];
  if (detail.inboxSnippet) {
    lines.push(`E-posta: ${detail.inboxSnippet.subject} — ${clip(detail.inboxSnippet.snippet, 500)}`);
  }
  for (const m of detail.messagingPreview?.messages ?? []) {
    const who = m.direction === 'customer' ? 'Müşteri' : 'Personel';
    lines.push(`${who}: ${clip(m.bodyText, 280)}`);
  }
  if (c.notes) lines.push(`Notlar: ${clip(c.notes, 600)}`);
  return lines.join('\n');
}

function localSummary(context) {
  const bullets = context
    .split('\n')
    .filter((l) => l.trim().length > 8)
    .slice(0, 8)
    .map((l) => `• ${l}`);
  return {
    ok: true,
    provider: 'local-template',
    kind: 'summary',
    text: ['Kısa özet (otomatik):', '', ...bullets, '', 'Sonraki adım: durumu doğrula, gerekirse kiracı 360 ve outbox kontrolü.'].join(
      '\n',
    ),
  };
}

function localDraftReply(detail) {
  const name = detail.case.requesterName?.split(/\s+/)[0] || 'Merhaba';
  const subject = detail.case.subject || 'talebiniz';
  const text = [
    `Merhaba ${name !== 'Merhaba' ? name : ''},`.trim(),
    '',
    `"${subject}" konulu kaydınızı inceledik. [Buraya net çözüm veya bilgi isteğini yazın.]`,
    '',
    'Herhangi bir ek bilgi paylaşmak isterseniz bu yazışmaya yanıt verebilirsiniz.',
    '',
    'Saygılarımızla,',
    'Ekolojik Destek',
  ].join('\n');
  return { ok: true, provider: 'local-template', kind: 'draft_reply', text };
}

async function callExternalAi(prompt) {
  const apiUrl = String(process.env.EKOLOJIK_POSTA_AI_URL ?? '').trim();
  const apiKey = String(process.env.EKOLOJIK_POSTA_AI_KEY ?? '').trim();
  if (!apiUrl || !apiKey) return null;

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.EKOLOJIK_POSTA_AI_MODEL || 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text =
    data.choices?.[0]?.message?.content?.trim() || data.output?.trim() || data.text?.trim() || null;
  return text;
}

export async function suggestPlatformSupportCaseAi(dataDir, caseId, { kind = 'summary' } = {}) {
  const detailRes = await getPlatformSupportCaseDetail(dataDir, caseId);
  if (!detailRes.ok) return detailRes;

  const context = buildContextText(detailRes);
  const mode = kind === 'draft_reply' ? 'draft_reply' : 'summary';

  const runtime = getPostaAiRuntimeConfig();
  const useExternal = isPostaAiEnabled() && runtime.hasApiKey && runtime.apiUrl;

  if (useExternal) {
    const prompt =
      mode === 'summary'
        ? `Türkçe, destek operatörü için 5-8 maddelik kısa özet yaz. Bağlam:\n${context}`
        : `Türkçe, profesyonel destek yanıtı taslağı yaz (imza: Ekolojik Destek). Bağlam:\n${context}`;
    try {
      const text = await callExternalAi(prompt);
      if (text) {
        return { ok: true, provider: 'external', kind: mode, text, ai: runtime };
      }
    } catch {
      /* fallback */
    }
  }

  return mode === 'summary' ? localSummary(context) : localDraftReply(detailRes);
}
