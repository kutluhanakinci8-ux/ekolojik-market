import assert from 'node:assert/strict';
import {
  normalizeMessageId,
  resolveInboxThreadRoot,
  mergeReferencesChain,
} from '../server/platformSupportEmailThread.mjs';

const root = {
  id: 'ps-root',
  messageId: '<root@mail.test>',
  outboundMessageIds: ['<auto@mail.test>'],
};
const rows = [root];

const hit = resolveInboxThreadRoot(rows, {
  inReplyTo: '<auto@mail.test>',
  references: '<root@mail.test> <auto@mail.test>',
});
assert.equal(hit?.root.id, 'ps-root', 'reply to autoreply threads to root');

const hit2 = resolveInboxThreadRoot(rows, {
  inReplyTo: '<unknown@test>',
});
assert.equal(hit2, null, 'unknown thread stays new');

assert.equal(normalizeMessageId('<Ab@c>'), 'ab@c');
assert.ok(mergeReferencesChain('<a@x>', '<b@y>').includes('<b@y>'));

console.log('platform-support-email-thread smoke: PASS');
