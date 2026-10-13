import assert from 'node:assert/strict';
import {
  normalizeMessageId,
  resolveInboxThreadRoot,
  mergeReferencesChain,
  buildCaseOutboundToInboxRootIndex,
} from '../server/platformSupportEmailThread.mjs';
import {
  parseCaseNumberFromAddressField,
  resolveInboundCaseNumber,
  supportPlusAddressForCase,
} from '../server/platformSupportEmailCaseRef.mjs';

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

const caseIdx = buildCaseOutboundToInboxRootIndex([
  { links: { inboxMessageId: 'ps-root', emailThread: { outboundIds: ['<only-on-case@test>'] } } },
]);
const hit3 = resolveInboxThreadRoot(rows, { inReplyTo: '<only-on-case@test>' }, caseIdx);
assert.equal(hit3?.root.id, 'ps-root', 'case outbound index threads');

assert.equal(parseCaseNumberFromAddressField('destek+case42@ekolojikmarket.com.tr'), 42);
assert.equal(
  resolveInboundCaseNumber({ subject: 'Re: [Destek #7] yardım' }),
  7,
);
assert.equal(supportPlusAddressForCase(7), 'destek+case7@ekolojikmarket.com.tr');

console.log('platform-support-email-thread smoke: PASS');
