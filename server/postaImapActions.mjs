import { buildImapClient, moveImapMessage } from './billEmailImap.mjs';
import { findPostaImapMessage, updatePostaImapMessage } from './postaInboxStore.mjs';
import {
  isEkolojikImapWriteEnabled,
  resolvePostaImapMailboxes,
} from './postaImapMailboxes.mjs';
import { getTenantImapConfig, isTenantImapConfigured } from './tenantMailConfig.mjs';

/** IMAP MOVE hedefi — Sent/Junk/Drafts/Trash (Faz 45 regression için saf fonksiyon). */
export function resolveImapMoveTarget(flagsPatch, row, mailboxes) {
  if (!row || !mailboxes) return null;
  const folder = String(row.imapFolder ?? 'inbox').toLowerCase();

  if (flagsPatch.trashed === true && mailboxes.trash) {
    return { targetPath: mailboxes.trash, targetFolder: 'trash' };
  }
  if (flagsPatch.spam === true && mailboxes.junk) {
    return { targetPath: mailboxes.junk, targetFolder: 'junk' };
  }
  if (flagsPatch.spam === false && folder === 'junk' && mailboxes.inbox) {
    return { targetPath: mailboxes.inbox, targetFolder: 'inbox' };
  }
  if (flagsPatch.trashed === false && folder === 'trash' && mailboxes.inbox) {
    return { targetPath: mailboxes.inbox, targetFolder: 'inbox' };
  }
  if (flagsPatch.trashed === false && flagsPatch.spam === false && mailboxes.inbox) {
    if (folder === 'junk' || folder === 'trash') {
      return { targetPath: mailboxes.inbox, targetFolder: 'inbox' };
    }
  }
  return null;
}

export async function applyImapMoveForFlags(dataDir, tenantId, inboxId, flagsPatch) {
  if (!(await isTenantImapConfigured(dataDir, tenantId)) || !isEkolojikImapWriteEnabled()) {
    return { ok: true, skipped: 'imap_write_disabled' };
  }
  const row = await findPostaImapMessage(dataDir, tenantId, inboxId);
  if (!row?.imapUid || !row.imapMailboxPath) {
    return { ok: true, skipped: 'no_imap_row' };
  }

  const config = await getTenantImapConfig(dataDir, tenantId);
  const client = buildImapClient(config);
  await client.connect();
  let mailboxes;
  try {
    mailboxes = await resolvePostaImapMailboxes(client);
  } finally {
    await client.logout();
  }

  const move = resolveImapMoveTarget(flagsPatch, row, mailboxes);
  const targetPath = move?.targetPath ?? null;
  const targetFolder = move?.targetFolder ?? null;

  if (!targetPath || targetPath === row.imapMailboxPath) {
    return { ok: true, skipped: 'no_move' };
  }

  try {
    const moved = await moveImapMessage(config, {
      fromMailbox: row.imapMailboxPath,
      uid: row.imapUid,
      toMailbox: targetPath,
    });
    await updatePostaImapMessage(dataDir, tenantId, inboxId, {
      imapMailboxPath: targetPath,
      imapFolder: targetFolder,
    });
    return { ok: true, moved, imapFolder: targetFolder };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'IMAP MOVE başarısız',
    };
  }
}
