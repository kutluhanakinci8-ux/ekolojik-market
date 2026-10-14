import type { PlatformSupportCaseDetail, PlatformSupportInboxAttachment } from '../services/platformApi';

export type CaseTimelineEntry =
  | {
      kind: 'email_in';
      at: string;
      key: string;
      inboxMessageId: string;
      from: string;
      label: string;
      bodyText: string;
      bodyHtml?: string | null;
      attachments?: PlatformSupportInboxAttachment[];
    }
  | {
      kind: 'email_out';
      at: string;
      key: string;
      label: string;
      bodyText?: string | null;
      bodyHtml?: string | null;
      messageId?: string | null;
    }
  | {
      kind: 'messaging';
      at: string;
      key: string;
      direction: string;
      authorName?: string;
      bodyText: string;
    };

export function buildCaseUnifiedTimeline(detail: PlatformSupportCaseDetail | null): CaseTimelineEntry[] {
  if (!detail) return [];
  const items: CaseTimelineEntry[] = [];
  const ep = detail.emailPreview;
  if (ep) {
    for (const m of ep.messages) {
      items.push({
        kind: 'email_in',
        at: m.receivedAt,
        key: `email-in-${m.id}`,
        inboxMessageId: m.id,
        from: m.from,
        label: m.isReply ? 'Gelen yanıt' : 'Gelen e-posta',
        bodyText: m.bodyText,
        bodyHtml: m.bodyHtml ?? null,
        attachments: m.attachments ?? [],
      });
    }
    ep.outboundEvents.forEach((e, idx) => {
      items.push({
        kind: 'email_out',
        at: e.at,
        key: `email-out-${e.at}-${idx}`,
        label: `Giden · ${e.kind}`,
        bodyText: e.textPreview ?? null,
        bodyHtml: e.htmlPreview ?? null,
        messageId: e.messageId ?? null,
      });
    });
  }
  for (const m of detail.messagingPreview?.messages ?? []) {
    items.push({
      kind: 'messaging',
      at: m.createdAt,
      key: `msg-${m.id}`,
      direction: m.direction,
      authorName: m.authorName,
      bodyText: m.bodyText,
    });
  }
  items.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return items;
}
