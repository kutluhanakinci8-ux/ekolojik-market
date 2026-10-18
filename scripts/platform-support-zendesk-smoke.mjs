#!/usr/bin/env node
import {
  inferCaseNumberFromZendeskWebhook,
  mapCaseStatusToZendesk,
  mapZendeskStatusToCase,
  platformCaseZendeskTag,
} from '../server/platformSupportZendesk.mjs';

function ok(cond, label) {
  if (!cond) throw new Error(label);
  console.log('OK', label);
}

ok(mapZendeskStatusToCase('hold') === 'pending', 'hold→pending');
ok(mapCaseStatusToZendesk('open') === 'open', 'case→zendesk');
ok(platformCaseZendeskTag(7) === 'platform_case_7', 'tag format');
ok(inferCaseNumberFromZendeskWebhook({ ticket: { external_id: 'platform-case-99' } }) === 99, 'external_id');
ok(inferCaseNumberFromZendeskWebhook({ ticket: { tags: ['platform_case_3'] } }) === 3, 'tags');

console.log('platform-support-zendesk-smoke: PASS');
