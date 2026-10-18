/** Konuşma (thread) gruplama — Message-ID / References / konu. */

export function normalizeSubject(subject) {
  return String(subject ?? '')
    .replace(/^(re|fwd|fw|yanit|ilet):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function parseThreadHeadersFromRaw(raw) {
  const text = String(raw ?? '');
  const inReplyTo = text.match(/^In-Reply-To:\s*(.+)$/im)?.[1]?.trim() ?? null;
  const references = text.match(/^References:\s*(.+)$/im)?.[1]?.trim() ?? null;
  return { inReplyTo, references };
}

function firstMessageId(token) {
  const m = String(token ?? '').match(/<[^>]+>/);
  return m ? m[0] : String(token ?? '').trim() || null;
}

export function threadKeyForItem(item) {
  const raw = item.raw ?? {};
  const refs = item.references ?? raw.references;
  const inReply = item.inReplyTo ?? raw.inReplyTo;
  const rootFromRefs = firstMessageId(refs);
  if (rootFromRefs) return `thread:${rootFromRefs}`;
  const replyId = firstMessageId(inReply);
  if (replyId) return `thread:${replyId}`;
  const mid = firstMessageId(item.messageId ?? raw.messageId);
  if (mid) return `thread:${mid}`;
  const subj = normalizeSubject(item.subject);
  const from = String(item.from ?? item.fromName ?? '')
    .toLowerCase()
    .match(/[\w.+-]+@[\w.-]+\.\w+/)?.[0] ?? String(item.from ?? '').toLowerCase();
  return `subj:${subj}|${from}`;
}

export function groupIntoConversations(items) {
  const buckets = new Map();
  for (const item of items) {
    const key = threadKeyForItem(item);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }

  const conversations = [];
  for (const [threadId, messages] of buckets.entries()) {
    const sorted = messages.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const latest = sorted[sorted.length - 1];
    const unread = sorted.some((m) => m.unread);
    conversations.push({
      id: threadId,
      kind: 'conversation',
      threadId,
      subject: latest?.subject ?? '(konu yok)',
      preview: latest?.preview ?? '',
      at: latest?.at ?? new Date().toISOString(),
      from: latest?.from,
      fromName: latest?.fromName,
      unread,
      starred: sorted.some((m) => m.starred),
      count: sorted.length,
      messages: sorted,
      sourceId: latest?.id ?? threadId,
    });
  }

  conversations.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return conversations;
}
