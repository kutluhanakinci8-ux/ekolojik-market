export type PlatformSupportActivityFilter =
  | 'all'
  | 'email_inbound'
  | 'email_outbound'
  | 'note'
  | 'zendesk'
  | 'case_meta'
  | 'messaging';

export type CaseActivityRow = { type: string };

export function filterCaseActivities<T extends CaseActivityRow>(
  items: T[],
  filter: PlatformSupportActivityFilter,
): T[] {
  if (filter === 'all') return items;
  if (filter === 'email_inbound') {
    return items.filter((a) => a.type === 'email_inbound' || a.type === 'email_inbound_closed');
  }
  if (filter === 'email_outbound') {
    return items.filter((a) => a.type === 'email_outbound' || a.type === 'email_out');
  }
  if (filter === 'zendesk') {
    return items.filter((a) => a.type === 'zendesk_webhook' || a.type === 'zendesk_push');
  }
  if (filter === 'case_meta') {
    return items.filter((a) => a.type === 'case_updated' || a.type === 'case_spawned');
  }
  if (filter === 'messaging') {
    return items.filter((a) => a.type === 'messaging_out');
  }
  return items.filter((a) => a.type === filter);
}

export const ACTIVITY_FILTER_EXPORT_SLUG: Record<PlatformSupportActivityFilter, string> = {
  all: '',
  email_inbound: 'gelen',
  email_outbound: 'giden',
  note: 'not',
  zendesk: 'zendesk',
  case_meta: 'kayit',
  messaging: 'mesaj',
};
