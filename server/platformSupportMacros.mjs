/** Destek makro şablonları — değişken doldurma */

export function supportMacroVariables(caseRow) {
  const firstName = String(caseRow?.requesterName ?? '')
    .trim()
    .split(/\s+/)[0];
  return {
    caseNumber: String(caseRow?.number ?? ''),
    subject: String(caseRow?.subject ?? '').trim(),
    requesterName: String(caseRow?.requesterName ?? '').trim(),
    requesterFirstName: firstName || 'müşterimiz',
    requesterEmail: String(caseRow?.requesterEmail ?? '').trim(),
    businessName: String(caseRow?.businessName ?? caseRow?.tenantId ?? '').trim(),
    tenantId: String(caseRow?.tenantId ?? '').trim(),
  };
}

export function applySupportMacroTemplate(body, caseRow) {
  const vars = supportMacroVariables(caseRow);
  return String(body ?? '').replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const val = vars[key];
    return val != null && String(val).length > 0 ? String(val) : match;
  });
}
