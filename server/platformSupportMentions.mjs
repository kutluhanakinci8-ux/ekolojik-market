/** Destek iç notları — @operatör bildirimi (Front tarzı) */

import { enqueueEkolojikMail } from './emailOutbox.mjs';
import { readPlatformOperatorsMeta } from './platformAuth.mjs';

const MENTION_RE = /@([a-zA-Z0-9][a-zA-Z0-9_.-]{1,31})/g;

export function extractMentionUsernames(text) {
  const found = new Set();
  const raw = String(text ?? '');
  for (const match of raw.matchAll(MENTION_RE)) {
    const u = match[1]?.trim().toLowerCase();
    if (u) found.add(u);
  }
  return [...found];
}

export async function listMentionableOperators(dataDir) {
  const meta = await readPlatformOperatorsMeta(dataDir);
  return (meta.operators ?? []).map((o) => ({
    username: o.username,
    displayName: o.displayName ?? o.username,
    recoveryEmail: o.recoveryEmail ?? null,
  }));
}

export async function notifyCaseNoteMentions(dataDir, { caseRow, noteBody, authorUsername }) {
  const mentions = extractMentionUsernames(noteBody);
  if (!mentions.length) return { notified: 0 };

  const operators = await listMentionableOperators(dataDir);
  const byUser = new Map(operators.map((o) => [o.username.toLowerCase(), o]));
  let notified = 0;

  for (const mention of mentions) {
    const op = byUser.get(mention);
    if (!op?.recoveryEmail) continue;
    const subject = `[Destek @] #${caseRow.number} — ${caseRow.subject ?? 'Kayıt'}`;
    const text = [
      `${authorUsername ?? 'Operatör'} sizi bir iç notta etiketledi.`,
      '',
      `Kayıt #${caseRow.number}: ${caseRow.subject ?? '—'}`,
      '',
      noteBody.slice(0, 2000),
    ].join('\n');
    await enqueueEkolojikMail(dataDir, {
      to: op.recoveryEmail,
      subject,
      text,
      source: 'platform-support-mention',
      tenantId: 'main',
      idempotencyKey: `mention:${caseRow.id}:${mention}:${Date.now()}`,
    });
    notified += 1;
  }

  if (notified > 0) {
    try {
      const { recordMentionInboxItems } = await import('./platformSupportMentionInbox.mjs');
      await recordMentionInboxItems(dataDir, {
        caseRow,
        mentions,
        authorUsername,
        noteBody,
      });
    } catch {
      /* in-app opsiyonel */
    }
  }

  return { notified, mentions };
}
