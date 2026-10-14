/** SLA özür maili — onaylı kuyruk ve toplu gönderim */

import { readPlatformCases, appendCaseActivity, getPlatformCase } from './platformCaseStore.mjs';
import { suggestPlatformSupportCaseAi } from './platformSupportAi.mjs';
import { performPlatformCaseAction } from './platformSupportCaseOmni.mjs';

function caseHadSlaApology(caseRow) {
  return (caseRow.activity ?? []).some((a) => a.type === 'sla_apology');
}

function isEligibleForSlaApology(caseRow, nowMs = Date.now()) {
  if (!caseRow?.requesterEmail?.includes('@')) return false;
  if (['solved', 'closed'].includes(caseRow.status)) return false;
  if (caseHadSlaApology(caseRow)) return false;
  const due = Date.parse(caseRow.slaDueAt ?? '');
  return Number.isFinite(due) && due < nowMs;
}

export async function buildSlaApologyQueue(dataDir, { limit = 30 } = {}) {
  const cases = await readPlatformCases(dataDir);
  const eligible = cases
    .filter((c) => isEligibleForSlaApology(c))
    .sort((a, b) => Date.parse(a.slaDueAt) - Date.parse(b.slaDueAt))
    .slice(0, Math.min(limit, 100))
    .map((c) => ({
      id: c.id,
      number: c.number,
      subject: c.subject,
      tenantId: c.tenantId,
      businessName: c.businessName,
      requesterEmail: c.requesterEmail,
      slaDueAt: c.slaDueAt,
      overdueMs: Date.now() - Date.parse(c.slaDueAt),
    }));

  return {
    generatedAt: new Date().toISOString(),
    count: eligible.length,
    items: eligible,
  };
}

export async function sendCaseSlaApologyEmail(dataDir, caseId, operatorUsername) {
  const caseRow = await getPlatformCase(dataDir, caseId);
  if (!caseRow) return { ok: false, error: 'Kayıt bulunamadı' };
  if (!isEligibleForSlaApology(caseRow)) {
    return { ok: false, error: 'Bu kayıt SLA özür kuyruğunda değil (e-posta, SLA veya daha önce gönderim)' };
  }

  const macro = await suggestPlatformSupportCaseAi(dataDir, caseId, {
    kind: 'apply_macro',
    macroId: 'sla_sorry',
  });
  if (!macro.ok || !macro.text?.trim()) {
    return { ok: false, error: macro.error ?? 'SLA makrosu yüklenemedi' };
  }

  const sent = await performPlatformCaseAction(
    dataDir,
    caseId,
    { channel: 'email', body: macro.text.trim() },
    operatorUsername,
  );
  if (!sent.ok) return sent;

  await appendCaseActivity(
    dataDir,
    caseId,
    { type: 'sla_apology', body: macro.text.trim(), channel: 'email' },
    operatorUsername,
  );

  return { ok: true, caseId, delivery: sent.delivery ?? null };
}

export async function sendSlaApologyBatch(dataDir, { caseIds }, operatorUsername) {
  const ids = Array.isArray(caseIds) ? caseIds.map((id) => String(id).trim()).filter(Boolean) : [];
  if (!ids.length) return { ok: false, error: 'caseIds gerekli' };

  const results = [];
  for (const id of ids.slice(0, 25)) {
    const r = await sendCaseSlaApologyEmail(dataDir, id, operatorUsername);
    results.push({ caseId: id, ...r });
  }
  const sent = results.filter((r) => r.ok).length;
  const failed = results.length - sent;
  return { ok: failed === 0, sent, failed, results };
}
