import type { IdentityDocumentCountry } from '../types/business';
import { IDENTITY_DOCUMENT_COUNTRY_OPTIONS } from '../types/business';
import { resolveIdentityFormatCountryFromName } from '../data/identityDocumentCountries';
import phoneDialCodesTr from '../data/phoneDialCodesTr.json';

export interface PhoneProfile {
  id: string;
  dialCode: string;
  maxNationalDigits: number;
  placeholder: string;
  formatNational: (digits: string) => string;
  normalizeNationalDigits: (digits: string) => string;
}

function normalizeCountryKey(name: string): string {
  return name.trim().toLocaleLowerCase('tr-TR');
}

function formatWithGroups(digits: string, groups: number[]): string {
  const parts: string[] = [];
  let i = 0;
  for (const size of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  if (i < digits.length) parts.push(digits.slice(i));
  return parts.join(' ');
}

function formatRuKzNational(digits: string): string {
  const raw = digits.replace(/\D/g, '').slice(0, 10);
  if (raw.length <= 3) return raw;
  if (raw.length <= 6) return `(${raw.slice(0, 3)}) ${raw.slice(3)}`;
  if (raw.length <= 8) return `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  return `(${raw.slice(0, 3)}) ${raw.slice(3, 6)}-${raw.slice(6, 8)}-${raw.slice(8)}`;
}

function formatGenericNational(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length <= 3) return d;
  const parts: string[] = [];
  for (let i = 0; i < d.length; i += 3) {
    parts.push(d.slice(i, i + 3));
  }
  return parts.join(' ');
}

function profile(
  id: string,
  dial: string,
  max: number,
  placeholder: string,
  formatNational: (digits: string) => string,
  normalizeNationalDigits?: (digits: string) => string,
): PhoneProfile {
  const normalize =
    normalizeNationalDigits ??
    ((d: string) => d.replace(/\D/g, '').slice(0, max));
  return {
    id,
    dialCode: dial,
    maxNationalDigits: max,
    placeholder,
    formatNational,
    normalizeNationalDigits: normalize,
  };
}

const IDENTITY_PHONE_PROFILES: Record<IdentityDocumentCountry, PhoneProfile> = {
  TR: profile(
    'TR',
    '+90',
    10,
    '5xx xxx xx xx',
    (d) => {
      let raw = d.replace(/\D/g, '');
      if (raw.startsWith('0')) raw = raw.slice(1);
      raw = raw.slice(0, 10);
      if (!raw) return '';
      return formatWithGroups(raw, [3, 3, 2, 2]);
    },
    (d) => {
      let raw = d.replace(/\D/g, '');
      if (raw.startsWith('0')) raw = raw.slice(1);
      return raw.slice(0, 10);
    },
  ),
  RU: profile('RU', '+7', 10, '(xxx) xxx-xx-xx', formatRuKzNational),
  KZ: profile('KZ', '+7', 10, '(xxx) xxx-xx-xx', formatRuKzNational),
  UZ: profile('UZ', '+998', 9, 'xx xxx xx xx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 9), [2, 3, 2, 2]),
  ),
  TM: profile('TM', '+993', 8, 'xx xxx xxx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 8), [2, 3, 3]),
  ),
  KG: profile('KG', '+996', 9, 'xxx xxx xxx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 9), [3, 3, 3]),
  ),
  AZ: profile('AZ', '+994', 9, 'xx xxx xx xx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 9), [2, 3, 2, 2]),
  ),
  AM: profile('AM', '+374', 8, 'xx xxx xxx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 8), [2, 3, 3]),
  ),
  TJ: profile('TJ', '+992', 9, 'xx xxx xxxx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 9), [2, 3, 4]),
  ),
  GE: profile('GE', '+995', 9, 'xxx xxx xxx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 9), [3, 3, 3]),
  ),
  UA: profile('UA', '+380', 9, 'xx xxx xx xx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 9), [2, 3, 2, 2]),
  ),
  MD: profile('MD', '+373', 8, 'xxxx xxxx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 8), [4, 4]),
  ),
  BY: profile('BY', '+375', 9, 'xx xxx xx xx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 9), [2, 3, 2, 2]),
  ),
  EE: profile('EE', '+372', 8, 'xxxx xxxx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 8), [4, 4]),
  ),
  LV: profile('LV', '+371', 8, 'xx xxx xxx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 8), [2, 3, 3]),
  ),
  LT: profile('LT', '+370', 8, 'xxxx xxxx', (d) =>
    formatWithGroups(d.replace(/\D/g, '').slice(0, 8), [4, 4]),
  ),
};

const DIAL_LOOKUP: Map<string, string> = new Map();
for (const [name, code] of Object.entries(phoneDialCodesTr as Record<string, string>)) {
  DIAL_LOOKUP.set(normalizeCountryKey(name), code);
}
for (const opt of IDENTITY_DOCUMENT_COUNTRY_OPTIONS) {
  const existing = IDENTITY_PHONE_PROFILES[opt.code];
  DIAL_LOOKUP.set(normalizeCountryKey(opt.label), existing.dialCode.replace('+', ''));
}
DIAL_LOOKUP.set(normalizeCountryKey('Türkiye'), '90');
DIAL_LOOKUP.set(normalizeCountryKey('turkey'), '90');
DIAL_LOOKUP.set(normalizeCountryKey('turkiye'), '90');

function createGenericProfile(dialDigits: string, id: string): PhoneProfile {
  const dialCode = `+${dialDigits}`;
  const max = dialDigits === '1' ? 10 : 12;
  return profile(
    id,
    dialCode,
    max,
    'xxx xxx xx xx',
    formatGenericNational,
    (d) => d.replace(/\D/g, '').slice(0, max),
  );
}

export function resolvePhoneProfile(countryName: string): PhoneProfile {
  const trimmed = countryName.trim();
  const format = resolveIdentityFormatCountryFromName(trimmed || 'Türkiye');
  if (format !== 'OTHER') {
    return IDENTITY_PHONE_PROFILES[format];
  }

  const key = normalizeCountryKey(trimmed);
  const dialDigits = DIAL_LOOKUP.get(key);
  if (dialDigits) {
    return createGenericProfile(dialDigits, `DIAL_${dialDigits}`);
  }

  return IDENTITY_PHONE_PROFILES.TR;
}

function dialDigitsOnly(dialCode: string): string {
  return dialCode.replace(/\D/g, '');
}

export function extractNationalDigits(storedPhone: string, profile: PhoneProfile): string {
  const all = storedPhone.replace(/\D/g, '');
  if (!all) return '';

  const dial = dialDigitsOnly(profile.dialCode);
  let national = all;
  if (dial && all.startsWith(dial)) {
    national = all.slice(dial.length);
  }

  return profile.normalizeNationalDigits(national);
}

export function composeStoredPhone(profile: PhoneProfile, nationalDigits: string): string {
  const national = profile.normalizeNationalDigits(nationalDigits);
  if (!national) return '';
  const formatted = profile.formatNational(national);
  return `${profile.dialCode} ${formatted}`.trim();
}

export function normalizePhoneForCountry(countryName: string, phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return '';
  const profile = resolvePhoneProfile(countryName);
  const national = extractNationalDigits(trimmed, profile);
  if (!national) return trimmed;
  return composeStoredPhone(profile, national);
}
