import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getEkolojikMailConfig, isEkolojikSmtpConfigured } from './ekolojikMailConfig.mjs';
import { verifyEkolojikSmtp } from './ekolojikSmtp.mjs';
import { getEffectiveMailPresentation } from './postaSettings.mjs';

const execFileAsync = promisify(execFile);

async function digTxt(name) {
  try {
    const { stdout } = await execFileAsync('dig', ['+short', 'TXT', name], { timeout: 8000 });
    return String(stdout ?? '')
      .split('\n')
      .map((line) => line.replace(/^"|"$/g, '').trim())
      .filter(Boolean)
      .join(' ');
  } catch {
    return '';
  }
}

function parseAliasesFromEnv() {
  const raw = String(process.env.EKOLOJIK_MAIL_ALIASES ?? '').trim();
  if (!raw) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.includes('@'));
}

function statusFromTxt(txt, pattern) {
  if (!txt?.trim()) return 'missing';
  if (pattern && !pattern.test(txt)) return 'warn';
  return 'ok';
}

export async function getPostaDeliverabilityHub(dataDir) {
  const domain =
    process.env.EKOLOJIK_MAIL_DOMAIN?.trim() ||
    (getEkolojikMailConfig().from?.split('@')[1] ?? 'ekolojikmarket.com.tr');
  const selector = process.env.EKOLOJIK_DKIM_SELECTOR?.trim() || 'ekolojik';
  const vpsIp = process.env.EKOLOJIK_VPS_PUBLIC_IP?.trim() || '168.231.109.27';

  const spfTxt = await digTxt(domain);
  const dmarcTxt = await digTxt(`_dmarc.${domain}`);
  let dkimTxt = '';
  for (const sel of [selector, 'default', 'mail', 'dkim', 'selector1']) {
    const d = await digTxt(`${sel}._domainkey.${domain}`);
    if (/v=DKIM1/i.test(d)) {
      dkimTxt = d;
      break;
    }
  }

  const pres = await getEffectiveMailPresentation(dataDir);
  const smtpConfigured = isEkolojikSmtpConfigured();
  const smtpVerify = smtpConfigured ? await verifyEkolojikSmtp() : { ok: false, error: 'SMTP yapılandırılmadı' };

  const suggested = {
    spf: `v=spf1 ip4:${vpsIp} a mx ~all`,
    dmarc: `v=DMARC1; p=none; rua=mailto:${pres.opsEmail || pres.from}`,
    dkimHint: `Panel/hosting: ${selector}._domainkey.${domain} (OpenDKIM veya sağlayıcı DKIM)`,
  };

  return {
    ok: true,
    domain,
    primaryFrom: pres.from,
    fromName: pres.fromName,
    replyTo: pres.replyTo,
    opsEmail: pres.opsEmail,
    aliases: parseAliasesFromEnv(),
    smtp: {
      configured: smtpConfigured,
      verified: Boolean(smtpVerify.ok),
      host: getEkolojikMailConfig().smtpHost || null,
      error: smtpVerify.error ?? null,
    },
    dns: {
      spf: { status: statusFromTxt(spfTxt, /v=spf1/i), value: spfTxt || null },
      dmarc: { status: statusFromTxt(dmarcTxt, /v=DMARC1/i), value: dmarcTxt || null },
      dkim: { status: statusFromTxt(dkimTxt, /v=DKIM1/i), value: dkimTxt ? `${dkimTxt.slice(0, 120)}…` : null },
      selector,
    },
    suggestedRecords: suggested,
    nbParity: 'PM-3/PM-7 deliverability hub (POS uyarlaması)',
  };
}
