/** Gelen destek e-postasını mevcut case'e bağlama (kapalı kayıt politikası) */

import { readSupportSlaPolicy, DEFAULT_SUPPORT_SLA_POLICY } from './platformSupportPolicy.mjs';
import { inboundBodyFromInboxRow } from './platformSupportActivityContent.mjs';

function isTerminalCaseStatus(status) {
  return ['solved', 'closed'].includes(String(status ?? '').toLowerCase());
}

export async function readClosedCaseInboundMode(dataDir) {
  const policy = await readSupportSlaPolicy(dataDir);
  const mode = String(policy.closedCaseInbound ?? DEFAULT_SUPPORT_SLA_POLICY.closedCaseInbound).trim();
  if (mode === 'keep_closed' || mode === 'new_case' || mode === 'reopen') return mode;
  return 'reopen';
}

/**
 * @returns {{ ok: true, case } | { spawnNewCase: true, fromCase }}
 */
export async function attachInboundEmailToCase(dataDir, linkedCase, row) {
  const preview = inboundBodyFromInboxRow(row);
  const mode = await readClosedCaseInboundMode(dataDir);
  const terminal = isTerminalCaseStatus(linkedCase.status);

  if (terminal && mode === 'new_case') {
    return { spawnNewCase: true, fromCase: linkedCase };
  }

  const { appendCaseActivity, updatePlatformCase, getPlatformCase } = await import('./platformCaseStore.mjs');

  if (terminal && mode === 'reopen') {
    await updatePlatformCase(dataDir, linkedCase.id, { status: 'open' }, 'system');
  }

  const activityType = terminal && mode === 'keep_closed' ? 'email_inbound_closed' : 'email_inbound';
  await appendCaseActivity(
    dataDir,
    linkedCase.id,
    {
      type: activityType,
      body: preview || '(boş gövde)',
      channel: 'email',
    },
    'system',
  );

  const fresh = await getPlatformCase(dataDir, linkedCase.id);
  return { ok: true, case: fresh ?? linkedCase };
}
