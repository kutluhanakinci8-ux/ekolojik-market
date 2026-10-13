/** Destek kaydı aktivite dışa aktarma */

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function buildCaseActivityCsv(caseRow) {
  const lines = ['createdAt,type,channel,createdBy,hasHtml,body'];
  const activity = [...(caseRow.activity ?? [])].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  for (const a of activity) {
    lines.push(
      [
        csvEscape(a.createdAt),
        csvEscape(a.type),
        csvEscape(a.channel),
        csvEscape(a.createdBy),
        csvEscape(a.html ? 'yes' : 'no'),
        csvEscape(a.body),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

export function buildCaseActivityPrintHtml(caseRow) {
  const activity = [...(caseRow.activity ?? [])].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
  const rows = activity
    .map(
      (a) => `<tr>
        <td>${escapeHtml(a.createdAt)}</td>
        <td>${escapeHtml(a.type)}</td>
        <td>${escapeHtml(a.createdBy)}</td>
        <td><pre style="white-space:pre-wrap;margin:0;font-family:inherit;">${escapeHtml(a.body)}</pre></td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8"/>
  <title>Destek #${caseRow.number} aktivite</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #1a2e1a; padding: 24px; }
    h1 { font-size: 1.25rem; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; vertical-align: top; }
    th { background: #f3f6f4; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>Destek kaydı #${caseRow.number} — ${escapeHtml(caseRow.subject || '')}</h1>
  <p>Durum: ${escapeHtml(caseRow.status)} · Dışa aktarma: ${new Date().toISOString()}</p>
  <table>
    <thead><tr><th>Zaman</th><th>Tür</th><th>Kullanıcı</th><th>İçerik</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">Aktivite yok</td></tr>'}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function caseActivityExportFilename(caseRow, ext) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `destek-kayit-${caseRow.number}-aktivite-${stamp}.${ext}`;
}
