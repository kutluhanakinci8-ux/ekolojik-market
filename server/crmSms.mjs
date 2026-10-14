/** CRM SMS — operatör API (Netgsm / generic HTTP / mock) */

function normalizeTrPhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('5')) return `90${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `9${digits}`;
  if (digits.length === 12 && digits.startsWith('90')) return digits;
  return digits.length >= 10 ? digits : '';
}

export function getCrmSmsConfig() {
  const provider = (process.env.EKOLOJIK_SMS_PROVIDER ?? 'http').trim().toLowerCase();
  return {
    provider,
    user: process.env.EKOLOJIK_SMS_USER?.trim() ?? '',
    pass: process.env.EKOLOJIK_SMS_PASS?.trim() ?? '',
    header: process.env.EKOLOJIK_SMS_HEADER?.trim() ?? process.env.EKOLOJIK_SMS_FROM?.trim() ?? '',
    httpUrl: process.env.EKOLOJIK_SMS_HTTP_URL?.trim() ?? '',
  };
}

export function isCrmSmsConfigured() {
  const c = getCrmSmsConfig();
  if (c.provider === 'mock') return true;
  if (c.provider === 'netgsm') return Boolean(c.user && c.pass && c.header);
  if (c.provider === 'http') return Boolean(c.httpUrl);
  return false;
}

async function sendNetgsm(phone, message, cfg) {
  const params = new URLSearchParams({
    usercode: cfg.user,
    password: cfg.pass,
    gsmno: phone,
    message,
    msgheader: cfg.header,
    dil: 'TR',
  });
  const url = `https://api.netgsm.com.tr/sms/send/get/?${params}`;
  const res = await fetch(url, { method: 'GET' });
  const text = await res.text();
  const code = String(text).trim().split(/\s+/)[0];
  if (code === '00' || code === '01' || code === '02') {
    return { ok: true, provider: 'netgsm', messageId: text.trim() };
  }
  return { ok: false, error: `Netgsm ${text.trim().slice(0, 120)}` };
}

async function sendHttpTemplate(phone, message, cfg) {
  const url = cfg.httpUrl
    .replaceAll('{phone}', encodeURIComponent(phone))
    .replaceAll('{message}', encodeURIComponent(message))
    .replaceAll('{header}', encodeURIComponent(cfg.header || ''));
  const res = await fetch(url, { method: 'GET' });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `SMS HTTP ${res.status}: ${text.slice(0, 120)}` };
  return { ok: true, provider: 'http', messageId: text.slice(0, 80) };
}

export async function sendCrmSms({ to, body }) {
  const phone = normalizeTrPhone(to);
  const message = String(body ?? '').trim();
  if (!phone) return { ok: false, error: 'Geçersiz telefon numarası' };
  if (!message) return { ok: false, error: 'SMS metni gerekli' };
  if (!isCrmSmsConfigured()) {
    return { ok: false, error: 'SMS operatör API yapılandırılmadı (EKOLOJIK_SMS_*)' };
  }

  const cfg = getCrmSmsConfig();
  if (cfg.provider === 'mock') {
    return { ok: true, provider: 'mock', messageId: `mock-sms-${Date.now()}` };
  }
  if (cfg.provider === 'netgsm') {
    return sendNetgsm(phone, message, cfg);
  }
  return sendHttpTemplate(phone, message, cfg);
}
