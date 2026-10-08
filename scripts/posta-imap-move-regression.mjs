#!/usr/bin/env node
/**
 * Faz 45 — IMAP MOVE hedef çözümleme (Sent/Junk/Drafts/Trash) saf regression.
 */
import { resolveImapMoveTarget } from '../server/postaImapActions.mjs';

const mailboxes = {
  inbox: 'INBOX',
  sent: 'Sent',
  junk: 'Junk',
  trash: 'Trash',
  drafts: 'Drafts',
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function test(name, fn) {
  try {
    fn();
    console.log(`OK    ${name}`);
    return true;
  } catch (e) {
    console.error(`FAIL  ${name}:`, e instanceof Error ? e.message : e);
    return false;
  }
}

let ok = true;
ok = test('spam → junk', () => {
  const t = resolveImapMoveTarget({ spam: true }, { imapFolder: 'inbox' }, mailboxes);
  assert(t?.targetFolder === 'junk', 'junk');
}) && ok;

ok = test('trash → Trash', () => {
  const t = resolveImapMoveTarget({ trashed: true }, { imapFolder: 'inbox' }, mailboxes);
  assert(t?.targetFolder === 'trash', 'trash');
}) && ok;

ok = test('junk + spam false → inbox', () => {
  const t = resolveImapMoveTarget({ spam: false }, { imapFolder: 'junk' }, mailboxes);
  assert(t?.targetFolder === 'inbox', 'inbox');
}) && ok;

ok = test('drafts + trash → trash', () => {
  const t = resolveImapMoveTarget({ trashed: true }, { imapFolder: 'drafts' }, mailboxes);
  assert(t?.targetFolder === 'trash', 'trash from drafts');
}) && ok;

if (!ok) process.exit(1);
console.log('\nIMAP MOVE regression: PASS');
