#!/usr/bin/env node
/** Platform destek API — yerel modül + opsiyonel canlı HTTP */
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { issuePlatformApiTokenFromCredentials, upsertPlatformOperator } from '../server/platformAuth.mjs';
import { buildPlatformSupportOverview } from '../server/platformSupportMetrics.mjs';
import { previewSmokeMessagingFilter } from '../server/platformSupportFilters.mjs';
import {
  inferCaseNumberFromZendeskWebhook,
  mapZendeskStatusToCase,
  platformCaseZendeskTag,
} from '../server/platformSupportZendesk.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Zendesk helpers
assert(mapZendeskStatusToCase('solved') === 'solved', 'zendesk status map');
assert(platformCaseZendeskTag(12) === 'platform_case_12', 'zendesk tag');
const n = inferCaseNumberFromZendeskWebhook({
  ticket: { tags: ['platform_case_42', 'other'] },
});
assert(n === 42, 'infer case from tag');

const tmp = await mkdtemp(join(tmpdir(), 'ps-api-smoke-'));
try {
  const password = 'smoke-platform-pass';
  await upsertPlatformOperator(tmp, {
    username: 'kutluhan08',
    passwordHash: createHash('sha256').update(password).digest('hex'),
    displayName: 'QA',
  });
  const tok = await issuePlatformApiTokenFromCredentials(tmp, { username: 'kutluhan08', password });
  assert(tok.ok && tok.token, 'platform token');

  const overview = await buildPlatformSupportOverview(tmp, { days: 7 });
  assert(overview.contactForm != null, 'contactForm in overview');
  assert(Array.isArray(overview.queue), 'queue array');

  const preview = await previewSmokeMessagingFilter(tmp, { hideSmoke: true, tenantIds: [], subjectPatterns: [], customerNamePatterns: [] });
  assert(preview.ok, 'smoke preview');

  const base = process.env.EKOLOJIK_QA_BASE_URL?.replace(/\/$/, '');
  if (base) {
    const anon = await fetch(`${base}/api/platform/support`);
    assert(anon.status === 401, 'platform support anon 401');
    const login = await fetch(`${base}/api/auth/pos-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'kutluhan08', password: process.env.PLATFORM_OPERATOR_PASSWORD || password }),
    });
    const loginJson = await login.json();
    if (login.ok && loginJson.token) {
      const h = { Authorization: `Bearer ${loginJson.token}` };
      for (const path of [
        '/api/platform/support',
        '/api/platform/support/contact-queue?limit=5',
        '/api/platform/support/smoke-filters',
      ]) {
        const r = await fetch(`${base}${path}`, { headers: h });
        assert(r.ok, `GET ${path} HTTP ${r.status}`);
      }
      const prev = await fetch(`${base}/api/platform/support/smoke-filters/preview`, {
        method: 'POST',
        headers: { ...h, 'Content-Type': 'application/json' },
        body: '{}',
      });
      const prevJson = await prev.json();
      assert(prev.ok && prevJson.ok, 'smoke preview HTTP');
    }
  }
} finally {
  await rm(tmp, { recursive: true, force: true });
}

console.log('platform-support-api-smoke: PASS');
