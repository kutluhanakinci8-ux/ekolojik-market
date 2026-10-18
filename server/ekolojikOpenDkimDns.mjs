import { readFile } from 'node:fs/promises';

/** OpenDKIM key file → single-line v=DKIM1;… for DNS TXT */
export async function readOpenDkimTxtOneLine(domain, selector = 'ekolojik') {
  const d = String(domain ?? '').trim().toLowerCase();
  const sel = String(selector ?? 'ekolojik').trim();
  if (!d || !sel) return null;
  const path = `/etc/opendkim/keys/${d}/${sel}.txt`;
  try {
    const raw = await readFile(path, 'utf8');
    const lines = raw.split('\n');
    let v = '';
    for (const line of lines) {
      if (!line.includes('"')) continue;
      const parts = line.split(/\s+/);
      for (const part of parts) {
        if (!part.includes('"') && !v) continue;
        v += part.replace(/^"|"$/g, '');
      }
    }
    v = v.replace(/\s+/g, '').replace(/\);.*$/, '').replace(/;;.*$/, '');
    return /v=DKIM1/i.test(v) ? v : null;
  } catch {
    return null;
  }
}
