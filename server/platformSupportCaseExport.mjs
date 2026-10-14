/** Destek kaydı aktivite dışa aktarma */

import { clipEmailActivityHtml, clipEmailActivityText } from './platformSupportActivityContent.mjs';

export const CASE_ACTIVITY_EXPORT_FILTERS = new Set(['all', 'email_inbound', 'email_outbound', 'note']);

const FILTER_FILENAME_SLUG = {
  all: '',
  email_inbound: 'gelen',
  email_outbound: 'giden',
  note: 'not',
};

function normalizeActivityFilter(filter) {
  const raw = String(filter ?? 'all').trim();
  return CASE_ACTIVITY_EXPORT_FILTERS.has(raw) ? raw : 'all';
}

/** Platform UI ile aynı filtre mantığı */
export function filterCaseActivities(activity, filter) {
  const f = normalizeActivityFilter(filter);
  const items = [...(activity ?? [])];
  if (f === 'all') return items;
  if (f === 'email_inbound') {
    return items.filter((a) => a.type === 'email_inbound' || a.type === 'email_inbound_closed');
  }
  if (f === 'email_outbound') {
    return items.filter((a) => a.type === 'email_outbound' || a.type === 'email_out');
  }
  return items.filter((a) => a.type === f);
}

function sortActivitiesNewestFirst(activity) {
  return [...activity].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function csvEscape(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function buildCaseActivityCsv(caseRow, { filter = 'all' } = {}) {
  const f = normalizeActivityFilter(filter);
  const lines = ['createdAt,type,channel,createdBy,body,html'];
  const activity = sortActivitiesNewestFirst(filterCaseActivities(caseRow.activity, f));
  for (const a of activity) {
    lines.push(
      [
        csvEscape(a.createdAt),
        csvEscape(a.type),
        csvEscape(a.channel),
        csvEscape(a.createdBy),
        csvEscape(clipEmailActivityText(a.body)),
        csvEscape(a.html ? clipEmailActivityHtml(a.html) : ''),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

function filterLabel(filter) {
  const map = {
    all: 'Tüm aktiviteler',
    email_inbound: 'Gelen e-posta',
    email_outbound: 'Giden e-posta',
    note: 'İç not',
  };
  return map[normalizeActivityFilter(filter)] ?? map.all;
}

export function buildCaseActivityPrintHtml(caseRow, { filter = 'all' } = {}) {
  const f = normalizeActivityFilter(filter);
  const activity = sortActivitiesNewestFirst(filterCaseActivities(caseRow.activity, f));
  const rows = activity
    .map((a) => {
      const body = escapeHtml(clipEmailActivityText(a.body));
      const htmlBlock = a.html
        ? `<details style="margin-top:6px;">
            <summary style="cursor:pointer;font-size:11px;color:#2d6a4f;">HTML gövde</summary>
            <iframe sandbox="" style="width:100%;min-height:120px;border:1px solid #c5d6ca;margin-top:6px;" srcdoc="${escapeAttr(
              clipEmailActivityHtml(a.html),
            )}"></iframe>
          </details>`
        : '';
      return `<tr>
        <td>${escapeHtml(a.createdAt)}</td>
        <td>${escapeHtml(a.type)}</td>
        <td>${escapeHtml(a.createdBy)}</td>
        <td><pre style="white-space:pre-wrap;margin:0;font-family:inherit;">${body}</pre>${htmlBlock}</td>
      </tr>`;
    })
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
    @media print { body { padding: 0; } details > summary { display: none; } details[open] iframe { min-height: 200px; } }
  </style>
</head>
<body>
  <h1>Destek kaydı #${caseRow.number} — ${escapeHtml(caseRow.subject || '')}</h1>
  <p>Durum: ${escapeHtml(caseRow.status)} · Filtre: ${escapeHtml(filterLabel(f))} · Dışa aktarma: ${new Date().toISOString()}</p>
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

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

export function caseActivityExportFilename(caseRow, ext, filter = 'all') {
  const stamp = new Date().toISOString().slice(0, 10);
  const f = normalizeActivityFilter(filter);
  const slug = FILTER_FILENAME_SLUG[f];
  const suffix = slug ? `-${slug}` : '';
  return `destek-kayit-${caseRow.number}-aktivite${suffix}-${stamp}.${ext}`;
}
