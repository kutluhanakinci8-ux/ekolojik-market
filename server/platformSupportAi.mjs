/** Destek D6 — case özet ve yanıt taslağı (TR); EKOLOJIK_POSTA_AI ile harici model */

import { isPostaAiEnabled, getPostaAiRuntimeConfig } from './messaging/aiConfig.mjs';
import { getPlatformSupportCaseDetail, listPlatformSupportMacros } from './platformSupportCaseOmni.mjs';
import { applySupportMacroTemplate } from './platformSupportMacros.mjs';

function clip(s, max = 400) {
  const t = String(s ?? '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function formatActivityLine(a) {
  const head = `${a.type} @ ${a.createdAt?.slice(0, 16) ?? '?'}`;
  return `${head}: ${clip(a.body, 320)}`;
}

function buildContextText(detail) {
  const c = detail.case;
  const lines = [
    `Kayıt #${c.number}`,
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
  const activity = [...(c.activity ?? [])].slice(0, 10);
  if (activity.length) {
    lines.push('Son aktivite:');
    for (const a of activity) {
      lines.push(formatActivityLine(a));
    }
  }
  if (c.notes) lines.push(`Notlar: ${clip(c.notes, 600)}`);
  return lines.join('\n');
}

function localSummary(context) {
  const bullets = context
    .split('\n')
    .filter((l) => l.trim().length > 8)
    .slice(0, 10)
    .map((l) => `• ${l}`);
  return {
    ok: true,
    provider: 'local-template',
    kind: 'summary',
    text: [
      'Kısa özet (otomatik):',
      '',
      ...bullets,
      '',
      'Sonraki adım: durumu doğrula, gerekirse kiracı 360 ve outbox kontrolü.',
    ].join('\n'),
  };
}

function localDraftReply(detail) {
  const { requesterFirstName } = applySupportMacroTemplate('{{requesterFirstName}}', detail.case);
  const subject = detail.case.subject || 'talebiniz';
  const lastInbound = (detail.case.activity ?? []).find(
    (a) => a.type === 'email_inbound' || a.type === 'email_inbound_closed',
  );
  const ref = lastInbound ? clip(lastInbound.body, 200) : null;
  const text = [
    `Merhaba ${requesterFirstName},`,
    '',
    `"${subject}" konulu kaydınızı (#${detail.case.number}) inceledik.`,
    ref ? `Son mesajınız: “${ref}”` : '[Buraya net çözüm veya bilgi isteğini yazın.]',
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
      max_tokens: 900,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text =
    data.choices?.[0]?.message?.content?.trim() || data.output?.trim() || data.text?.trim() || null;
  return text;
}

export function getPlatformSupportAiCapabilities() {
  const runtime = getPostaAiRuntimeConfig();
  return {
    externalEnabled: isPostaAiEnabled() && runtime.hasApiKey && Boolean(runtime.apiUrl),
    provider: runtime.provider,
    model: runtime.model,
  };
}

export async function suggestPlatformSupportCaseAi(dataDir, caseId, { kind = 'summary', macroId, draft } = {}) {
  const detailRes = await getPlatformSupportCaseDetail(dataDir, caseId);
  if (!detailRes.ok) return detailRes;

  const context = buildContextText(detailRes);
  const mode = kind === 'draft_reply' ? 'draft_reply' : kind;

  const runtime = getPostaAiRuntimeConfig();
  const useExternal = isPostaAiEnabled() && runtime.hasApiKey && runtime.apiUrl;

  if (mode === 'apply_macro') {
    const macros = detailRes.macros ?? await listPlatformSupportMacros(dataDir);
    const macro = macros.find((m) => m.id === macroId);
    if (!macro) return { ok: false, error: 'Makro bulunamadı' };
    const text = applySupportMacroTemplate(macro.body, detailRes.case);
    return { ok: true, provider: 'macro', kind: 'apply_macro', text, macroId: macro.id };
  }

  if (mode === 'personalize_macro') {
    const macros = detailRes.macros ?? await listPlatformSupportMacros(dataDir);
    const macro = macros.find((m) => m.id === macroId);
    if (!macro) return { ok: false, error: 'Makro bulunamadı' };
    const filled = applySupportMacroTemplate(macro.body, detailRes.case);
    if (useExternal) {
      const prompt = `Türkçe destek yanıtı: aşağıdaki şablonu bağlama uygun şekilde kişiselleştir; imza "Ekolojik Destek" kalsın; gereksiz tekrar etme.\n\nŞablon:\n${filled}\n\nBağlam:\n${context}`;
      try {
        const text = await callExternalAi(prompt);
        if (text) {
          return { ok: true, provider: 'external', kind: 'personalize_macro', text, macroId: macro.id, ai: runtime };
        }
      } catch {
        /* fallback */
      }
    }
    return { ok: true, provider: 'macro', kind: 'personalize_macro', text: filled, macroId: macro.id };
  }

  if (mode === 'refine_draft') {
    const base = String(draft ?? '').trim();
    if (!base) return { ok: false, error: 'Taslak metni gerekli' };
    if (useExternal) {
      const prompt = `Türkçe destek yanıtını düzenle: net, profesyonel, kibar; imza Ekolojik Destek.\n\nBağlam:\n${context}\n\nTaslak:\n${base}`;
      try {
        const text = await callExternalAi(prompt);
        if (text) {
          return { ok: true, provider: 'external', kind: 'refine_draft', text, ai: runtime };
        }
      } catch {
        /* fallback */
      }
    }
    return { ok: true, provider: 'local-template', kind: 'refine_draft', text: base };
  }

  if (useExternal) {
    const prompt =
      mode === 'summary'
        ? `Türkçe, destek operatörü için 5-8 maddelik kısa özet yaz. Bağlam:\n${context}`
        : `Türkçe, profesyonel destek yanıtı taslağı yaz (imza: Ekolojik Destek). Bağlam:\n${context}`;
    try {
      const text = await callExternalAi(prompt);
      if (text) {
        return { ok: true, provider: 'external', kind: mode === 'draft_reply' ? 'draft_reply' : 'summary', text, ai: runtime };
      }
    } catch {
      /* fallback */
    }
  }

  return mode === 'draft_reply' ? localDraftReply(detailRes) : localSummary(context);
}
