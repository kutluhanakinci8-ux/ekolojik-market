import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getEkolojikMailConfig } from './ekolojikMailConfig.mjs';
import { verifyEkolojikSmtp } from './ekolojikSmtp.mjs';
import { getEffectiveMailPresentation } from './postaSettings.mjs';
import { getTenantSmtpMailConfig, isTenantSmtpConfigured } from './tenantMailConfig.mjs';
import { readTenantStore, writeTenantStore } from './tenantAuth.mjs';
import { readOpenDkimTxtOneLine } from './ekolojikOpenDkimDns.mjs';

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

function normalizeAliasList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s).trim().toLowerCase()).filter((s) => s.includes('@'));
}

export function defaultAliasesForDomain(domain) {
  const d = String(domain ?? '').trim().toLowerCase();
  if (!d) return [];
  return [`siparis@${d}`, `fatura@${d}`];
}

function domainFromEmail(email) {
  const part = String(email ?? '').split('@')[1];
  return part?.trim().toLowerCase() || '';
}

function resolveMailDomain(pres) {
  const fromDomain = domainFromEmail(pres.from);
  if (fromDomain) return fromDomain;
  const envDomain = process.env.EKOLOJIK_MAIL_DOMAIN?.trim();
  if (envDomain) return envDomain;
  return getEkolojikMailConfig().from?.split('@')[1]?.trim().toLowerCase() || 'ekolojikmarket.com.tr';
}

function statusFromTxt(txt, pattern) {
  if (!txt?.trim()) return 'missing';
  if (pattern && !pattern.test(txt)) return 'warn';
  return 'ok';
}

async function resolveTenantAliases(dataDir, tenantId, domain) {
  const store = await readTenantStore(dataDir, tenantId);
  const fromSettings = normalizeAliasList(store?.settings?.postaAliases);
  if (fromSettings.length) {
    return { aliases: fromSettings, source: 'tenant' };
  }
  const env = parseAliasesFromEnv();
  if (env.length) {
    return { aliases: env, source: 'env' };
  }
  return { aliases: defaultAliasesForDomain(domain), source: 'generated' };
}

export async function seedTenantPostaAliases(dataDir, tenantId = 'main') {
  const store = await readTenantStore(dataDir, tenantId);
  if (!store) return { ok: false, error: 'Mağaza bulunamadı' };
  const existing = normalizeAliasList(store.settings?.postaAliases);
  if (existing.length) {
    return { ok: true, seeded: false, aliases: existing };
  }
  const pres = await getEffectiveMailPresentation(dataDir, tenantId);
  const domain = resolveMailDomain(pres);
  const aliases = defaultAliasesForDomain(domain);
  const settings = { ...(store.settings ?? {}), postaAliases: aliases };
  const next = { ...store, settings, updatedAt: new Date().toISOString() };
  await writeTenantStore(dataDir, tenantId, next);
  return { ok: true, seeded: true, aliases };
}

function dmarcRua(pres, domain) {
  const addr = pres.opsEmail || pres.from || `postmaster@${domain}`;
  const mail = String(addr).includes('@') ? addr : `postmaster@${domain}`;
  return `mailto:${mail}`;
}

function buildDnsChecklist(domain, pres, vpsIp, selector, dns, dkimSuggested) {
  const suggestedSpf = `v=spf1 a mx ip4:${vpsIp} ~all`;
  const suggestedDmarc = `v=DMARC1; p=quarantine; rua=${dmarcRua(pres, domain)}; pct=100`;
  const dkimName = `${selector}._domainkey.${domain}`;
  const dkimValue =
    dkimSuggested ||
    `OpenDKIM: bash scripts/sunucu-ekolojik-opendkim-kur.sh (host: ${selector}._domainkey)`;
  return [
    {
      id: 'spf',
      label: 'SPF',
      recordName: domain,
      panelHost: '@',
      recordType: 'TXT',
      status: dns.spf.status,
      current: dns.spf.value,
      suggested: suggestedSpf,
    },
    {
      id: 'dmarc',
      label: 'DMARC',
      recordName: `_dmarc.${domain}`,
      panelHost: '_dmarc',
      recordType: 'TXT',
      status: dns.dmarc.status,
      current: dns.dmarc.value,
      suggested: suggestedDmarc,
    },
    {
      id: 'dkim',
      label: 'DKIM',
      recordName: dkimName,
      panelHost: `${selector}._domainkey`,
      recordType: 'TXT',
      status: dns.dkim.status,
      current: dns.dkim.value,
      suggested: dkimValue,
    },
  ];
}

export async function getPostaDeliverabilityHub(dataDir, tenantId = 'main') {
  const pres = await getEffectiveMailPresentation(dataDir, tenantId);
  const domain = resolveMailDomain(pres);
  const selector = process.env.EKOLOJIK_DKIM_SELECTOR?.trim() || 'ekolojik';
  const vpsIp = process.env.EKOLOJIK_VPS_PUBLIC_IP?.trim() || '168.231.109.27';

  const spfTxt = await digTxt(domain);
  const dmarcTxt = await digTxt(`_dmarc.${domain}`);
  let dkimTxt = '';
  let dkimSelectorUsed = selector;
  for (const sel of [selector, 'default', 'mail', 'dkim', 'selector1']) {
    const d = await digTxt(`${sel}._domainkey.${domain}`);
    if (/v=DKIM1/i.test(d)) {
      dkimTxt = d;
      dkimSelectorUsed = sel;
      break;
    }
  }

  const smtpConfigured = await isTenantSmtpConfigured(dataDir, tenantId);
  const smtpVerify = smtpConfigured
    ? await verifyEkolojikSmtp({ dataDir, tenantId })
    : { ok: false, error: 'SMTP yapılandırılmadı' };
  const mailCfg = await getTenantSmtpMailConfig(dataDir, tenantId);
  const localDkimTxt = await readOpenDkimTxtOneLine(domain, selector);

  const { aliases, source: aliasesSource } = await resolveTenantAliases(dataDir, tenantId, domain);

  const dns = {
    spf: { status: statusFromTxt(spfTxt, /v=spf1/i), value: spfTxt || null },
    dmarc: { status: statusFromTxt(dmarcTxt, /v=DMARC1/i), value: dmarcTxt || null },
    dkim: {
      status: statusFromTxt(dkimTxt, /v=DKIM1/i),
      value: dkimTxt ? `${dkimTxt.slice(0, 120)}…` : null,
    },
    selector: dkimSelectorUsed,
  };

  const suggestedRecords = {
    spf: `v=spf1 a mx ip4:${vpsIp} ~all`,
    dmarc: `v=DMARC1; p=quarantine; rua=${dmarcRua(pres, domain)}; pct=100`,
    dkim: localDkimTxt,
    dkimHint: localDkimTxt
      ? `${dkimSelectorUsed}._domainkey.${domain}`
      : `Panel/hosting: ${dkimSelectorUsed}._domainkey.${domain} (OpenDKIM)`,
  };

  const dnsChecklist = buildDnsChecklist(
    domain,
    pres,
    vpsIp,
    dkimSelectorUsed,
    dns,
    localDkimTxt,
  );
  const missingDns = dnsChecklist.filter((r) => r.status !== 'ok').map((r) => r.id);
  const deliverabilityReady = missingDns.length === 0 && Boolean(smtpVerify.ok);

  return {
    ok: true,
    domain,
    primaryFrom: pres.from,
    fromName: pres.fromName,
    replyTo: pres.replyTo,
    opsEmail: pres.opsEmail,
    aliases,
    aliasesSource,
    tenantId,
    smtp: {
      configured: smtpConfigured,
      verified: Boolean(smtpVerify.ok),
      host: mailCfg.smtpHost || null,
      error: smtpVerify.error ?? null,
    },
    dns,
    suggestedRecords,
    dnsChecklist,
    missingDns,
    deliverabilityReady,
    dnsPanelGuide: {
      provider: 'Turhost',
      ns: ['dns1.turhost.com', 'dns2.turhost.com'],
      docPath: 'docs/EKOLOJIK-DNS-TURHOST-PANEL.md',
      strictCommand:
        'EKOLOJIK_DNS_STRICT=1 bash scripts/sunucu-ekolojik-dns-mail-dogrula.sh',
    },
    nbParity: 'PM-3/PM-7 deliverability hub (tenant From domain, Faz 43)',
  };
}
