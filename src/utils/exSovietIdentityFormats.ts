function upperAlnum(value: string): string {
  return value.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g, '');
}

function singleLetterPlusSeven(
  upper: string,
  letters: Set<string>,
  defaultLetter: string,
): string {
  if (!upper) return '';
  const first = upper[0];
  if (/[0-9]/.test(first)) {
    return `${defaultLetter}${upper.replace(/[^0-9]/g, '').slice(0, 7)}`;
  }
  if (letters.has(first)) {
    return `${first}${upper.slice(1).replace(/[^0-9]/g, '').slice(0, 7)}`;
  }
  if (upper.length === 1 && letters.has(first)) return first;
  const digits = upper.replace(/[^0-9]/g, '').slice(0, 7);
  return digits ? `${defaultLetter}${digits}` : '';
}

function twoLetterPlusSeven(upper: string, prefixes: Set<string>): string {
  if (!upper) return '';
  const prefix2 = upper.slice(0, 2);
  if (upper.length >= 2 && prefixes.has(prefix2)) {
    const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
    return `${prefix2}${digits}`;
  }
  if (upper.length < 2 && [...prefixes].some((p) => p.startsWith(upper))) {
    return upper;
  }
  if (upper.length === 2 && !/[0-9]/.test(upper) && prefixes.has(prefix2)) {
    return upper;
  }
  const letters = upper.replace(/[^A-Z]/g, '').slice(0, 2);
  const digits = upper.slice(letters.length).replace(/[^0-9]/g, '').slice(0, 7);
  return `${letters}${digits}`.slice(0, 9);
}

/** Türkmenistan: A, D, S + 7 rakam */
const TM_LETTERS = new Set(['A', 'D', 'S']);
export const TM_IDENTITY_PATTERN = /^[ADS]\d{7}$/;

export function parseTurkmenistanIdentityInput(value: string): string {
  return singleLetterPlusSeven(upperAlnum(value), TM_LETTERS, 'A');
}

export function isValidTurkmenistanIdentity(cleaned: string): boolean {
  return TM_IDENTITY_PATTERN.test(cleaned);
}

/** Azerbaycan: C, P, D, S + 7 rakam */
const AZ_LETTERS = new Set(['C', 'P', 'D', 'S']);
export const AZ_IDENTITY_PATTERN = /^[CPDS]\d{7}$/;

export function parseAzerbaijanIdentityInput(value: string): string {
  return singleLetterPlusSeven(upperAlnum(value), AZ_LETTERS, 'C');
}

export function isValidAzerbaijanIdentity(cleaned: string): boolean {
  return AZ_IDENTITY_PATTERN.test(cleaned);
}

/** Ermenistan: AM, AN, AE, AR + 7 rakam */
const AM_PREFIXES = new Set(['AM', 'AN', 'AE', 'AR']);
export const AM_IDENTITY_PATTERN = /^(?:AM|AN|AE|AR)\d{7}$/;

export function parseArmeniaIdentityInput(value: string): string {
  return twoLetterPlusSeven(upperAlnum(value), AM_PREFIXES);
}

export function isValidArmeniaIdentity(cleaned: string): boolean {
  return AM_IDENTITY_PATTERN.test(cleaned);
}

/** Tacikistan: HR, CR veya eski M + 7 rakam */
export const TJ_IDENTITY_PATTERN = /^(?:(?:HR|CR)|M)\d{7}$/;

export function parseTajikistanIdentityInput(value: string): string {
  const upper = upperAlnum(value);
  if (!upper) return '';
  const prefix2 = upper.slice(0, 2);
  if (prefix2 === 'HR' || prefix2 === 'CR') {
    const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
    return `${prefix2}${digits}`;
  }
  if (upper.length < 2 && (upper === 'H' || upper === 'C' || upper === 'M')) {
    return upper;
  }
  if (upper[0] === 'M') {
    if (upper.length === 1) return 'M';
    if (upper[1] === 'H' || upper[1] === 'R') {
      return twoLetterPlusSeven(upper, new Set(['HR', 'CR']));
    }
    const digits = upper.slice(1).replace(/[^0-9]/g, '').slice(0, 7);
    return `M${digits}`;
  }
  return twoLetterPlusSeven(upper, new Set(['HR', 'CR']));
}

export function isValidTajikistanIdentity(cleaned: string): boolean {
  return TJ_IDENTITY_PATTERN.test(cleaned);
}

/** Gürcistan: A, B, D + 7 rakam */
const GE_LETTERS = new Set(['A', 'B', 'D']);
export const GE_IDENTITY_PATTERN = /^[ABD]\d{7}$/;

export function parseGeorgiaIdentityInput(value: string): string {
  return singleLetterPlusSeven(upperAlnum(value), GE_LETTERS, 'A');
}

export function isValidGeorgiaIdentity(cleaned: string): boolean {
  return GE_IDENTITY_PATTERN.test(cleaned);
}

/** Ukrayna: 9 rakam (harf yok) */
export const UA_IDENTITY_PATTERN = /^\d{9}$/;

export function parseUkraineIdentityInput(value: string): string {
  return upperAlnum(value).replace(/[^0-9]/g, '').slice(0, 9);
}

export function isValidUkraineIdentity(cleaned: string): boolean {
  return UA_IDENTITY_PATTERN.test(cleaned);
}

/** Moldova: A/B + 7–8 rakam veya yalnızca 7–8 rakam */
export const MD_IDENTITY_PATTERN = /^(?:[AB]?\d{7,8})$/;

export function parseMoldovaIdentityInput(value: string): string {
  const upper = upperAlnum(value);
  if (!upper) return '';
  if (/^[0-9]/.test(upper)) {
    return upper.replace(/[^0-9]/g, '').slice(0, 8);
  }
  if (upper[0] === 'A' || upper[0] === 'B') {
    if (upper.length === 1) return upper[0];
    const digits = upper.slice(1).replace(/[^0-9]/g, '').slice(0, 8);
    return `${upper[0]}${digits}`;
  }
  return upper.slice(0, 9);
}

export function isValidMoldovaIdentity(cleaned: string): boolean {
  return MD_IDENTITY_PATTERN.test(cleaned);
}

/** Belarus: AB, BM, HB, KH, PP + 7 rakam */
const BY_PREFIXES = new Set(['AB', 'BM', 'HB', 'KH', 'PP']);
export const BY_IDENTITY_PATTERN = /^(?:AB|BM|HB|KH|PP)\d{7}$/;

export function parseBelarusIdentityInput(value: string): string {
  return twoLetterPlusSeven(upperAlnum(value), BY_PREFIXES);
}

export function isValidBelarusIdentity(cleaned: string): boolean {
  return BY_IDENTITY_PATTERN.test(cleaned);
}

/** Estonya: EE + 7 rakam */
export const EE_IDENTITY_PATTERN = /^EE\d{7}$/;

export function parseEstoniaIdentityInput(value: string): string {
  const upper = upperAlnum(value);
  if (!upper) return '';
  if (upper[0] === 'E') {
    if (upper.length === 1) return 'E';
    if (upper[1] !== 'E') return 'E';
    const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
    return `EE${digits}`;
  }
  const digits = upper.replace(/[^0-9]/g, '').slice(0, 7);
  return digits ? `EE${digits}` : '';
}

export function isValidEstoniaIdentity(cleaned: string): boolean {
  return EE_IDENTITY_PATTERN.test(cleaned);
}

/** Letonya: LV + 7 rakam veya eski yalnızca 7 rakam */
export const LV_IDENTITY_PATTERN = /^(?:LV\d{7}|\d{7})$/;

export function parseLatviaIdentityInput(value: string): string {
  const upper = upperAlnum(value);
  if (!upper) return '';
  if (/^[0-9]/.test(upper)) {
    return upper.replace(/[^0-9]/g, '').slice(0, 7);
  }
  if (upper[0] === 'L') {
    if (upper.length === 1) return 'L';
    if (upper[1] === 'V') {
      const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
      return `LV${digits}`;
    }
    return 'L';
  }
  return upper.replace(/[^0-9]/g, '').slice(0, 7);
}

export function isValidLatviaIdentity(cleaned: string): boolean {
  return LV_IDENTITY_PATTERN.test(cleaned);
}

/** Litvanya: 8 rakam */
export const LT_IDENTITY_PATTERN = /^\d{8}$/;

export function parseLithuaniaIdentityInput(value: string): string {
  return upperAlnum(value).replace(/[^0-9]/g, '').slice(0, 8);
}

export function isValidLithuaniaIdentity(cleaned: string): boolean {
  return LT_IDENTITY_PATTERN.test(cleaned);
}
