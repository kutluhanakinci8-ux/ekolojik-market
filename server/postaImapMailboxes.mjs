/** NB parite — IMAP klasör adları (sunucuya göre çözülür). */

export const MAILBOX_CANDIDATES = {
  inbox: ['INBOX'],
  sent: ['Sent', 'Sent Messages', 'Sent Items', 'INBOX.Sent', 'INBOX/Sent', '[Gmail]/Sent Mail'],
  trash: ['Trash', 'Deleted', 'INBOX.Trash', 'INBOX/Trash', 'Deleted Items', '[Gmail]/Trash'],
  junk: ['Junk', 'Spam', 'Junk E-mail', 'INBOX.Junk', 'INBOX/Spam', '[Gmail]/Spam'],
  drafts: ['Drafts', 'INBOX.Drafts', 'INBOX/Drafts', '[Gmail]/Drafts'],
};

export function isEkolojikImapWriteEnabled() {
  return process.env.EKOLOJIK_IMAP_WRITE === '1';
}

export async function resolvePostaImapMailboxes(client) {
  const listed = await client.list();
  const paths = new Set(listed.map((m) => m.path));
  const pick = (candidates) => candidates.find((p) => paths.has(p)) ?? null;
  return {
    inbox: pick(MAILBOX_CANDIDATES.inbox) || 'INBOX',
    sent: pick(MAILBOX_CANDIDATES.sent),
    trash: pick(MAILBOX_CANDIDATES.trash),
    junk: pick(MAILBOX_CANDIDATES.junk),
    drafts: pick(MAILBOX_CANDIDATES.drafts),
  };
}
