import {
  resolveIdentityFormatCountryFromName,
  type IdentityFormatCountry,
} from '../data/identityDocumentCountries';
import type { Customer, CustomerType, IdentityDocumentCountry } from '../types/business';
import { IDENTITY_DOCUMENT_COUNTRY_CODES, IDENTITY_DOCUMENT_COUNTRY_OPTIONS } from '../types/business';
import {
  isValidArmeniaIdentity,
  isValidAzerbaijanIdentity,
  isValidBelarusIdentity,
  isValidEstoniaIdentity,
  isValidGeorgiaIdentity,
  isValidLatviaIdentity,
  isValidLithuaniaIdentity,
  isValidMoldovaIdentity,
  isValidTajikistanIdentity,
  isValidTurkmenistanIdentity,
  isValidUkraineIdentity,
  parseArmeniaIdentityInput,
  parseAzerbaijanIdentityInput,
  parseBelarusIdentityInput,
  parseEstoniaIdentityInput,
  parseGeorgiaIdentityInput,
  parseLatviaIdentityInput,
  parseLithuaniaIdentityInput,
  parseMoldovaIdentityInput,
  parseTajikistanIdentityInput,
  parseTurkmenistanIdentityInput,
  parseUkraineIdentityInput,
} from './exSovietIdentityFormats';

/** Örnek: kz36812345 — 2 küçük harf + 8 rakam */
export const GREENLEAF_NO_PATTERN = /^[a-z]{2}\d{8}$/;
export const GREENLEAF_NO_PLACEHOLDER = 'kz36812345';
export const GREENLEAF_NO_HINT = '2 harf + 8 rakam (7 rakamda başına 0 eklenir)';

/** Kazakistan pasaport: N (umumi), D (diplomatik), S (hizmet) + 7 rakam */
const KZ_PASSPORT_WITH_LETTER_PATTERN = /^[NDS]\d{7}$/;
const KZ_STATELESS_PATTERN = /^CT\d{7}$/;
/** İç kimlik (9) veya harfsiz eski belgeler (7–9 rakam) */
const KZ_NUMERIC_IDENTITY_PATTERN = /^\d{7,9}$/;
const KZ_PASSPORT_PREFIXES = new Set(['N', 'D', 'S']);

function normalizeKazakhstanIdentityLetters(value: string): string {
  return value
    .replace(/\u0421/g, 'C')
    .replace(/\u0422/g, 'T')
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9]/g, '');
}

function parseKazakhstanIdentityInput(value: string): string {
  const upper = normalizeKazakhstanIdentityLetters(value);
  if (!upper) return '';

  if (/^[0-9]/.test(upper)) {
    return upper.replace(/[^0-9]/g, '').slice(0, 9);
  }

  if (upper[0] === 'C') {
    if (upper.length === 1) return 'C';
    if (upper[1] === 'T') {
      const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
      return `CT${digits}`;
    }
    return 'C';
  }

  const first = upper[0];
  if (KZ_PASSPORT_PREFIXES.has(first)) {
    const digits = upper.slice(1).replace(/[^0-9]/g, '').slice(0, 7);
    return `${first}${digits}`;
  }

  const digitsOnly = upper.replace(/[^0-9]/g, '');
  if (digitsOnly) return digitsOnly.slice(0, 9);

  return '';
}

function isValidKazakhstanIdentity(cleaned: string): boolean {
  if (!cleaned) return false;
  return (
    KZ_PASSPORT_WITH_LETTER_PATTERN.test(cleaned) ||
    KZ_STATELESS_PATTERN.test(cleaned) ||
    KZ_NUMERIC_IDENTITY_PATTERN.test(cleaned)
  );
}

/** Kırgızistan biyometrik: AC, AN, DA, SA + 7 rakam (9 hane) */
const KG_BIOMETRIC_PREFIXES = new Set(['AC', 'AN', 'DA', 'SA']);
const KG_BIOMETRIC_PATTERN = /^(AC|AN|DA|SA)\d{7}$/;
/** Eski pasaport: A, D veya S + 7 rakam (8 hane) */
const KG_LEGACY_SINGLE_LETTER_PATTERN = /^[ADS]\d{7}$/;
/** İç kimlik: eski ID + 7 rakam (9), yeni I + 7 rakam (8) */
const KG_ID_CARD_LEGACY_PATTERN = /^ID\d{7}$/;
const KG_ID_CARD_NEW_PATTERN = /^I\d{7}$/;

function isKyrgyzstanBiometricPrefixPartial(prefix: string): boolean {
  if (!prefix) return false;
  if (KG_BIOMETRIC_PREFIXES.has(prefix)) return true;
  return [...KG_BIOMETRIC_PREFIXES].some((candidate) => candidate.startsWith(prefix));
}

function parseKyrgyzstanIdentityInput(value: string): string {
  const upper = value.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g, '');
  if (!upper) return '';

  const prefix2 = upper.slice(0, 2);
  if (upper.length >= 2 && KG_BIOMETRIC_PREFIXES.has(prefix2)) {
    const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
    return `${prefix2}${digits}`;
  }

  if (upper.length < 2 && isKyrgyzstanBiometricPrefixPartial(upper)) {
    return upper;
  }

  if (upper.length === 2 && !/[0-9]/.test(upper) && isKyrgyzstanBiometricPrefixPartial(upper)) {
    return upper;
  }

  if (upper[0] === 'I') {
    if (upper.length === 1) return 'I';
    if (upper[1] === 'D') {
      if (upper.length === 2) return 'ID';
      const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
      return `ID${digits}`;
    }
    const digits = upper.slice(1).replace(/[^0-9]/g, '').slice(0, 7);
    return `I${digits}`;
  }

  const first = upper[0];
  if (first === 'A' || first === 'D' || first === 'S') {
    if (upper.length >= 2 && (prefix2 === 'AC' || prefix2 === 'AN' || prefix2 === 'DA' || prefix2 === 'SA')) {
      const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
      return `${prefix2}${digits}`;
    }
    if (upper.length === 1) return first;
    if (first === 'A' && (upper[1] === 'C' || upper[1] === 'N')) {
      const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
      return `${prefix2}${digits}`;
    }
    if ((first === 'D' || first === 'S') && upper[1] === 'A') {
      const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
      return `${prefix2}${digits}`;
    }
    const digits = upper.slice(1).replace(/[^0-9]/g, '').slice(0, 7);
    return `${first}${digits}`;
  }

  const letters = upper.replace(/[^A-Z]/g, '').slice(0, 2);
  const digits = upper.slice(letters.length).replace(/[^0-9]/g, '').slice(0, 7);
  return `${letters}${digits}`.slice(0, 9);
}

function isValidKyrgyzstanIdentity(cleaned: string): boolean {
  if (!cleaned) return false;
  return (
    KG_BIOMETRIC_PATTERN.test(cleaned) ||
    KG_LEGACY_SINGLE_LETTER_PATTERN.test(cleaned) ||
    KG_ID_CARD_LEGACY_PATTERN.test(cleaned) ||
    KG_ID_CARD_NEW_PATTERN.test(cleaned)
  );
}

/** Özbekistan pasaport: 2 harf + 7 rakam (9 hane) */
const UZ_PASSPORT_PREFIXES = new Set(['FA', 'FB', 'FC', 'FD', 'AA', 'AB', 'EX', 'TT', 'SE']);
const UZ_PASSPORT_PATTERN = /^(FA|FB|FC|FD|AA|AB|EX|TT|SE)\d{7}$/;
const UZ_ID_CARD_PATTERN = /^ID\d{7}$/;

function isUzbekistanPrefixPartial(prefix: string): boolean {
  if (!prefix) return false;
  if (prefix === 'I' || 'ID'.startsWith(prefix)) return true;
  return [...UZ_PASSPORT_PREFIXES].some((candidate) => candidate.startsWith(prefix));
}

function parseUzbekistanIdentityInput(value: string): string {
  const upper = value.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g, '');
  if (!upper) return '';

  if (upper[0] === 'I') {
    if (upper.length === 1) return 'I';
    if (upper[1] === 'D') {
      if (upper.length === 2) return 'ID';
      const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
      return `ID${digits}`;
    }
    return 'I';
  }

  const prefix2 = upper.slice(0, 2);
  if (upper.length >= 2 && UZ_PASSPORT_PREFIXES.has(prefix2)) {
    const digits = upper.slice(2).replace(/[^0-9]/g, '').slice(0, 7);
    return `${prefix2}${digits}`;
  }

  if (upper.length < 2 && isUzbekistanPrefixPartial(upper)) {
    return upper;
  }

  if (upper.length === 2 && !/[0-9]/.test(upper) && isUzbekistanPrefixPartial(upper)) {
    return upper;
  }

  const letters = upper.replace(/[^A-Z]/g, '').slice(0, 2);
  const digits = upper.slice(letters.length).replace(/[^0-9]/g, '').slice(0, 7);
  return `${letters}${digits}`.slice(0, 9);
}

function isValidUzbekistanIdentity(cleaned: string): boolean {
  if (!cleaned) return false;
  return UZ_PASSPORT_PATTERN.test(cleaned) || UZ_ID_CARD_PATTERN.test(cleaned);
}

export function normalizeIdentityDocumentCountry(
  value: unknown,
): IdentityDocumentCountry {
  if (
    typeof value === 'string' &&
    (IDENTITY_DOCUMENT_COUNTRY_CODES as string[]).includes(value)
  ) {
    return value as IdentityDocumentCountry;
  }
  return 'TR';
}

export function getIdentityDocumentMaxLength(country: IdentityFormatCountry): number {
  if (country === 'OTHER') return 20;
  switch (country) {
    case 'RU':
    case 'UA':
      return 9;
    case 'LT':
      return 8;
    case 'TM':
    case 'AZ':
    case 'GE':
      return 8;
    case 'MD':
      return 9;
    case 'LV':
      return 9;
    case 'TR':
      return 20;
    default:
      return 9;
  }
}

export function isIdentityDocumentNumericInput(country: IdentityFormatCountry): boolean {
  return country === 'RU' || country === 'UA' || country === 'LT';
}

export function getIdentityDocumentHint(country: IdentityDocumentCountry): string {
  const opt = IDENTITY_DOCUMENT_COUNTRY_OPTIONS.find((o) => o.code === country);
  return opt?.example ?? '';
}

export function resolveIdentityFormatCountry(
  countryName?: string,
  countryCode?: IdentityDocumentCountry,
): IdentityFormatCountry {
  if (countryName?.trim()) {
    return resolveIdentityFormatCountryFromName(countryName);
  }
  if (countryCode) return normalizeIdentityDocumentCountry(countryCode);
  return 'TR';
}

export function getIdentityDocumentHintForFormat(country: IdentityFormatCountry): string {
  if (country === 'OTHER') {
    return 'Pasaport veya ulusal kimlik no (5–20 karakter)';
  }
  return getIdentityDocumentHint(country);
}

export function normalizeTaxNumber(value: string): string {
  return value.replace(/\D/g, '');
}

/** Yazarken: küçük harf, yalnızca harf/rakam, en fazla 10 karakter */
export function parseGreenleafNumberInput(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
}

/** 2 harf + 8 rakam tamamlandı mı (otomatik alan geçişi için) */
export function isGreenleafInputComplete(value: string): boolean {
  return /^[a-z]{2}\d{8}$/.test(parseGreenleafNumberInput(value));
}

export function parseUppercaseNameInput(value: string): string {
  return value.toLocaleUpperCase('tr-TR');
}

export function parseSponsorNameInput(value: string): string {
  return parseUppercaseNameInput(value);
}

export function parseCustomerNameInput(value: string): string {
  return parseUppercaseNameInput(value);
}

/** Bireysel müşteri: TC (11 hane) veya pasaport (harf+rakam) — Türkiye */
export function parseIndividualIdentityInput(value: string): string {
  return value
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);
}

export function parseIdentityDocumentInput(
  value: string,
  country: IdentityFormatCountry,
): string {
  if (country === 'OTHER') {
    return parseIndividualIdentityInput(value);
  }
  const upper = value.toLocaleUpperCase('tr-TR').replace(/[^A-Z0-9]/g, '');
  switch (country) {
    case 'RU':
      return upper.replace(/[^0-9]/g, '').slice(0, 9);
    case 'KZ':
      return parseKazakhstanIdentityInput(value);
    case 'TM':
      return parseTurkmenistanIdentityInput(value);
    case 'KG':
      return parseKyrgyzstanIdentityInput(value);
    case 'UZ':
      return parseUzbekistanIdentityInput(value);
    case 'AZ':
      return parseAzerbaijanIdentityInput(value);
    case 'AM':
      return parseArmeniaIdentityInput(value);
    case 'TJ':
      return parseTajikistanIdentityInput(value);
    case 'GE':
      return parseGeorgiaIdentityInput(value);
    case 'UA':
      return parseUkraineIdentityInput(value);
    case 'MD':
      return parseMoldovaIdentityInput(value);
    case 'BY':
      return parseBelarusIdentityInput(value);
    case 'EE':
      return parseEstoniaIdentityInput(value);
    case 'LV':
      return parseLatviaIdentityInput(value);
    case 'LT':
      return parseLithuaniaIdentityInput(value);
    case 'TR':
    default:
      return parseIndividualIdentityInput(value);
  }
}

function isValidTrIndividualIdentity(value: string): boolean {
  const cleaned = parseIndividualIdentityInput(value);
  if (!cleaned) return false;
  if (/^\d{11}$/.test(cleaned)) return true;
  return cleaned.length >= 5 && cleaned.length <= 20;
}

function isValidOtherCountryIdentity(value: string): boolean {
  const cleaned = parseIndividualIdentityInput(value);
  return cleaned.length >= 5 && cleaned.length <= 20;
}

export function isValidIdentityDocument(
  value: string,
  country: IdentityFormatCountry,
): boolean {
  const cleaned = parseIdentityDocumentInput(value, country);
  if (!cleaned) return false;
  if (country === 'OTHER') return isValidOtherCountryIdentity(cleaned);
  switch (country) {
    case 'RU':
      return /^\d{9}$/.test(cleaned);
    case 'KZ':
      return isValidKazakhstanIdentity(cleaned);
    case 'TM':
      return isValidTurkmenistanIdentity(cleaned);
    case 'KG':
      return isValidKyrgyzstanIdentity(cleaned);
    case 'UZ':
      return isValidUzbekistanIdentity(cleaned);
    case 'AZ':
      return isValidAzerbaijanIdentity(cleaned);
    case 'AM':
      return isValidArmeniaIdentity(cleaned);
    case 'TJ':
      return isValidTajikistanIdentity(cleaned);
    case 'GE':
      return isValidGeorgiaIdentity(cleaned);
    case 'UA':
      return isValidUkraineIdentity(cleaned);
    case 'MD':
      return isValidMoldovaIdentity(cleaned);
    case 'BY':
      return isValidBelarusIdentity(cleaned);
    case 'EE':
      return isValidEstoniaIdentity(cleaned);
    case 'LV':
      return isValidLatviaIdentity(cleaned);
    case 'LT':
      return isValidLithuaniaIdentity(cleaned);
    case 'TR':
    default:
      return isValidTrIndividualIdentity(cleaned);
  }
}

/** Yalnızca rakam — TR TC girişi (pasaportta harf olur) */
export function isTcNumericIdentityEntry(value: string): boolean {
  const cleaned = parseIndividualIdentityInput(value);
  return cleaned.length > 0 && /^\d+$/.test(cleaned);
}

export function isTcIdentityComplete(value: string): boolean {
  return /^\d{11}$/.test(parseIndividualIdentityInput(value));
}

export function isIdentityDocumentComplete(
  value: string,
  country: IdentityFormatCountry,
): boolean {
  const cleaned = parseIdentityDocumentInput(value, country);
  if (country === 'OTHER') {
    return isValidOtherCountryIdentity(cleaned);
  }
  switch (country) {
    case 'RU':
      return /^\d{9}$/.test(cleaned);
    case 'KZ':
      return isValidKazakhstanIdentity(cleaned);
    case 'TM':
      return isValidTurkmenistanIdentity(cleaned);
    case 'KG':
      return isValidKyrgyzstanIdentity(cleaned);
    case 'UZ':
      return isValidUzbekistanIdentity(cleaned);
    case 'AZ':
      return isValidAzerbaijanIdentity(cleaned);
    case 'AM':
      return isValidArmeniaIdentity(cleaned);
    case 'TJ':
      return isValidTajikistanIdentity(cleaned);
    case 'GE':
      return isValidGeorgiaIdentity(cleaned);
    case 'UA':
      return isValidUkraineIdentity(cleaned);
    case 'MD':
      return isValidMoldovaIdentity(cleaned);
    case 'BY':
      return isValidBelarusIdentity(cleaned);
    case 'EE':
      return isValidEstoniaIdentity(cleaned);
    case 'LV':
      return isValidLatviaIdentity(cleaned);
    case 'LT':
      return isValidLithuaniaIdentity(cleaned);
    case 'TR':
      return isTcNumericIdentityEntry(cleaned) && isTcIdentityComplete(cleaned);
    default:
      return false;
  }
}

/** Kimlik tamamlandığında adres alanına geçiş (TR pasaport hariç) */
export function shouldAutoFocusAddressAfterIdentity(
  value: string,
  country: IdentityFormatCountry,
): boolean {
  return isIdentityDocumentComplete(value, country);
}

/**
 * Geçerli Greenleaf no döndürür; format dışıysa undefined.
 * 7 haneli rakam kısmına başına 0 eklenir.
 */
export function normalizeGreenleafNumber(value: string): string | undefined {
  const raw = value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!raw) return undefined;

  const match = raw.match(/^([a-z]{2})(\d+)$/);
  if (!match) return undefined;

  let digits = match[2];
  if (digits.length === 7) {
    digits = `0${digits}`;
  }
  if (digits.length !== 8) return undefined;

  return `${match[1]}${digits}`;
}

export function isValidGreenleafNumber(value: string): boolean {
  return normalizeGreenleafNumber(value) !== undefined;
}

export function validateCustomerInput(
  data: {
    type: CustomerType;
    name: string;
    greenleafNumber?: string;
    sponsorName?: string;
    sponsorGreenleafNumber?: string;
    taxNumber: string;
    identityDocumentCountry?: IdentityDocumentCountry;
    identityDocumentCountryName?: string;
    taxOffice?: string;
    address: string;
    city: string;
    district: string;
    email?: string;
  },
  options?: {
    existingCustomers?: Customer[];
    editingId?: string;
  },
): string | null {
  if (!data.name.trim()) {
    return data.type === 'corporate' ? 'Firma unvanı zorunludur.' : 'Ad soyad zorunludur.';
  }

  const greenleafNumber = data.greenleafNumber?.trim()
    ? normalizeGreenleafNumber(data.greenleafNumber)
    : undefined;
  if (data.greenleafNumber?.trim() && !greenleafNumber) {
    return `Greenleaf numarası geçersiz. Örnek: ${GREENLEAF_NO_PLACEHOLDER}`;
  }
  if (greenleafNumber) {
    const duplicate = options?.existingCustomers?.find(
      (customer) =>
        customer.greenleafNumber === greenleafNumber && customer.id !== options.editingId,
    );
    if (duplicate) {
      return 'Bu Greenleaf numarası başka bir müşteride kayıtlı.';
    }
  }

  const sponsorGreenleafNumber = data.sponsorGreenleafNumber?.trim()
    ? normalizeGreenleafNumber(data.sponsorGreenleafNumber)
    : undefined;
  if (data.sponsorGreenleafNumber?.trim() && !sponsorGreenleafNumber) {
    return `Sponsor Greenleaf numarası geçersiz. Örnek: ${GREENLEAF_NO_PLACEHOLDER}`;
  }

  if (data.type === 'individual') {
    if (!data.identityDocumentCountryName?.trim()) {
      return 'Kimlik / pasaport ülkesi zorunludur.';
    }
    const docCountry = resolveIdentityFormatCountry(
      data.identityDocumentCountryName,
      data.identityDocumentCountry,
    );
    if (!isValidIdentityDocument(data.taxNumber, docCountry)) {
      const hint = getIdentityDocumentHintForFormat(docCountry);
      return hint
        ? `Geçerli kimlik / pasaport numarası girin. Örnek: ${hint}`
        : 'Geçerli TC kimlik no (11 hane) veya pasaport numarası girin.';
    }
  } else {
    const tax = normalizeTaxNumber(data.taxNumber);
    if (!tax) {
      return 'Vergi kimlik no (VKN) zorunludur.';
    }
    if (tax.length !== 10) return 'Vergi kimlik no (VKN) 10 haneli olmalıdır.';
    if (!data.taxOffice?.trim()) return 'Vergi dairesi zorunludur.';
  }

  if (!data.address.trim()) return 'Adres zorunludur.';
  if (!data.city.trim()) return 'İl zorunludur.';
  if (!data.district.trim()) return 'İlçe zorunludur.';

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return 'Geçerli bir e-posta girin.';
  }

  return null;
}

export function formatTaxNumber(
  type: CustomerType,
  taxNumber: string,
  identityDocumentCountry?: IdentityDocumentCountry,
  identityDocumentCountryName?: string,
): string {
  if (type === 'individual') {
    const country = resolveIdentityFormatCountry(identityDocumentCountryName, identityDocumentCountry);
    return parseIdentityDocumentInput(taxNumber, country);
  }
  return normalizeTaxNumber(taxNumber).slice(0, 10);
}

export function formatGreenleafNumber(greenleafNumber: string): string {
  const normalized = normalizeGreenleafNumber(greenleafNumber);
  if (!normalized) {
    throw new Error(`Geçersiz Greenleaf numarası. Örnek: ${GREENLEAF_NO_PLACEHOLDER}`);
  }
  return normalized;
}

export function getCustomerInvoiceLabel(customer: Customer): string {
  const greenleaf = customer.greenleafNumber ? `${customer.greenleafNumber} · ` : '';
  if (customer.type === 'corporate') {
    return `${greenleaf}VKN ${customer.taxNumber}`;
  }
  const docCountry = resolveIdentityFormatCountry(
    customer.identityDocumentCountryName,
    customer.identityDocumentCountry,
  );
  if (docCountry === 'TR') {
    return `${greenleaf}TC ${customer.taxNumber}`;
  }
  if (docCountry === 'OTHER') {
    const label = customer.identityDocumentCountryName?.trim() || 'Pasaport';
    return `${greenleaf}${label} ${customer.taxNumber}`;
  }
  return `${greenleaf}${docCountry} ${customer.taxNumber}`;
}

/** Kasiyer satış ekranından hızlı müşteri kaydı için minimum doğrulama */
export function validateQuickCustomerInput(
  data: { name: string; greenleafNumber: string },
  options?: { existingCustomers?: Customer[] },
): string | null {
  const name = data.name.trim();
  if (!name) {
    return 'Müşteri adı zorunludur.';
  }

  const greenleafNumber = normalizeGreenleafNumber(data.greenleafNumber);
  if (!greenleafNumber) {
    return `Geçerli bir Greenleaf numarası girin. Örnek: ${GREENLEAF_NO_PLACEHOLDER}`;
  }

  const duplicate = options?.existingCustomers?.find(
    (customer) => customer.greenleafNumber === greenleafNumber,
  );
  if (duplicate) {
    return null;
  }

  return null;
}

export function buildQuickCustomerPayload(
  name: string,
  greenleafNumber: string,
  registeredBy?: string,
): Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> {
  const normalizedGl = normalizeGreenleafNumber(greenleafNumber);
  if (!normalizedGl) {
    throw new Error(`Geçersiz Greenleaf numarası. Örnek: ${GREENLEAF_NO_PLACEHOLDER}`);
  }

  const uniqueSuffix = Date.now().toString().slice(-10).padStart(10, '0');

  return {
    type: 'individual',
    name: name.trim(),
    greenleafNumber: normalizedGl,
    taxNumber: `9${uniqueSuffix}`,
    identityDocumentCountry: 'TR',
    identityDocumentCountryName: 'TÜRKİYE',
    address: '-',
    city: '-',
    district: '-',
    country: 'Türkiye',
    notes: 'Kasiyer satış ekranından otomatik kayıt — bilgileri tamamlayın.',
    registeredFrom: 'pos',
    registeredBy,
  };
}

export function customerMatchesSearch(customer: Customer, query: string): boolean {
  const q = query.toLowerCase();
  return (
    customer.name.toLowerCase().includes(q) ||
    customer.greenleafNumber?.toLowerCase().includes(q) ||
    customer.sponsorName?.toLowerCase().includes(q) ||
    customer.sponsorGreenleafNumber?.toLowerCase().includes(q) ||
    customer.taxNumber.includes(q) ||
    customer.phone?.includes(q) ||
    customer.email?.toLowerCase().includes(q) ||
    customer.city.toLowerCase().includes(q) ||
    customer.district.toLowerCase().includes(q) ||
    customer.taxOffice?.toLowerCase().includes(q) ||
    customer.address.toLowerCase().includes(q)
  );
}
