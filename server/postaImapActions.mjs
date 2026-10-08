import { buildImapClient, moveImapMessage } from './billEmailImap.mjs';
import { findPostaImapMessage, updatePostaImapMessage } from './postaInboxStore.mjs';
import {
  isEkolojikImapWriteEnabled,
  resolvePostaImapMailboxes,
} from './postaImapMailboxes.mjs';
import { getTenantImapConfig, isTenantImapConfigured } from './tenantMailConfig.mjs';

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

  let targetPath = null;
  let targetFolder = null;
  if (flagsPatch.trashed === true && mailboxes.trash) {
    targetPath = mailboxes.trash;
    targetFolder = 'trash';
  } else if (flagsPatch.spam === true && mailboxes.junk) {
    targetPath = mailboxes.junk;
    targetFolder = 'junk';
  } else if (flagsPatch.trashed === false && flagsPatch.spam === false && mailboxes.inbox) {
    targetPath = mailboxes.inbox;
    targetFolder = 'inbox';
  }

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
