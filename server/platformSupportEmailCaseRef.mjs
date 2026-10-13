/** destek@ plus-alias ve gövde/konu case token ayrıştırma */

const DOMAIN_PATTERN = 'ekolojikmarket\\.com\\.tr';

export function parseCaseNumberFromAddressField(value) {
  const text = String(value ?? '');
  const plus = text.match(
    new RegExp(`destek\\+case(\\d{1,9})@${DOMAIN_PATTERN}`, 'i'),
  );
  if (plus) return Number(plus[1]);
  const shortPlus = text.match(new RegExp(`destek\\+(\\d{1,9})@${DOMAIN_PATTERN}`, 'i'));
  if (shortPlus) return Number(shortPlus[1]);
  return null;
}

export function parseCaseNumberFromSubject(subject) {
  const text = String(subject ?? '');
  const bracket = text.match(/\[EKO-DESTEK-(\d{1,9})\]/i);
  if (bracket) return Number(bracket[1]);
  const tag = text.match(/\[Destek\s*#(\d{1,9})\]/i);
  if (tag) return Number(tag[1]);
  return null;
}

export function resolveInboundCaseNumber({ to, deliveredTo, subject } = {}) {
  const fields = [to, deliveredTo, subject];
  for (const field of fields) {
    const fromAddr = parseCaseNumberFromAddressField(field);
    if (fromAddr) return fromAddr;
  }
  return parseCaseNumberFromSubject(subject);
}

export function supportPlusAddressForCase(caseNumber, domain = 'ekolojikmarket.com.tr') {
  const n = Number(caseNumber);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `destek+case${n}@${domain}`;
}
