import type { IdentityDocumentCountry } from '../types/business';
import { resolveIdentityFormatCountryFromName } from '../data/identityDocumentCountries';
import turkeyProvinceDistricts from '../data/turkeyProvinceDistricts.json';
import exSovietRegionCities from '../data/exSovietRegionCities.json';

export const STRUCTURED_ADDRESS_COUNTRY_CODES = [
  'TR',
  'TM',
  'AZ',
  'UA',
  'RU',
  'BY',
  'EE',
  'LV',
  'LT',
  'KG',
  'UZ',
  'KZ',
] as const satisfies readonly IdentityDocumentCountry[];

export type StructuredAddressCountry = (typeof STRUCTURED_ADDRESS_COUNTRY_CODES)[number];

const LOCALE_BY_COUNTRY: Record<StructuredAddressCountry, string> = {
  TR: 'tr-TR',
  RU: 'ru-RU',
  BY: 'ru-RU',
  KZ: 'ru-RU',
  KG: 'ru-RU',
  UZ: 'uz-UZ',
  TM: 'tk-TM',
  UA: 'uk-UA',
  AZ: 'az-AZ',
  EE: 'et-EE',
  LV: 'lv-LV',
  LT: 'lt-LT',
};

const EX_SOVIET_DATA = exSovietRegionCities as Record<
  Exclude<StructuredAddressCountry, 'TR'>,
  Record<string, string[]>
>;

function getRegionMap(country: StructuredAddressCountry): Record<string, string[]> {
  if (country === 'TR') return turkeyProvinceDistricts as Record<string, string[]>;
  return EX_SOVIET_DATA[country] ?? {};
}

function localeFor(country: StructuredAddressCountry): string {
  return LOCALE_BY_COUNTRY[country] ?? 'en-US';
}

function normalizeQuery(value: string, country: StructuredAddressCountry): string {
  return value.trim().toLocaleLowerCase(localeFor(country));
}

export function formatStructuredLocationInput(
  value: string,
  country: StructuredAddressCountry,
): string {
  return value.toLocaleUpperCase(localeFor(country));
}

function displayLocationName(canonical: string, country: StructuredAddressCountry): string {
  return canonical.toLocaleUpperCase(localeFor(country));
}

export interface LocationInlineCompletion {
  fullLabel: string;
  suffix: string;
  uniquePrefix: boolean;
}

function regionNames(country: StructuredAddressCountry): string[] {
  return Object.keys(getRegionMap(country)).sort((a, b) =>
    a.localeCompare(b, localeFor(country)),
  );
}

function scoreMatch(
  label: string,
  query: string,
  country: StructuredAddressCountry,
): number {
  const l = normalizeQuery(label, country);
  const q = normalizeQuery(query, country);
  if (!q) return 99;
  if (l === q) return 0;
  if (l.startsWith(q)) return 1;
  if (l.includes(q)) return 2;
  return 99;
}

function buildInlineCompletion(
  candidates: string[],
  query: string,
  country: StructuredAddressCountry,
): LocationInlineCompletion | null {
  const q = query.trim();
  if (!q) return null;

  const exact = candidates.find(
    (c) => normalizeQuery(c, country) === normalizeQuery(q, country),
  );
  if (exact) {
    return {
      fullLabel: displayLocationName(exact, country),
      suffix: '',
      uniquePrefix: true,
    };
  }

  const prefixMatches = candidates.filter((c) =>
    normalizeQuery(c, country).startsWith(normalizeQuery(q, country)),
  );
  const ranked = candidates
    .filter((c) => scoreMatch(c, q, country) < 99)
    .sort((a, b) => scoreMatch(a, q, country) - scoreMatch(b, q, country));

  const best = ranked[0];
  if (!best) return null;
  if (!normalizeQuery(best, country).startsWith(normalizeQuery(q, country))) {
    return null;
  }

  const uniquePrefix = prefixMatches.length === 1;
  const fullLabel = displayLocationName(best, country);
  const typedUpper = formatStructuredLocationInput(q, country);
  const suffix =
    normalizeQuery(best, country).startsWith(normalizeQuery(q, country))
      ? fullLabel.slice(typedUpper.length)
      : '';

  return { fullLabel, suffix, uniquePrefix };
}

function findRegionKey(name: string, country: StructuredAddressCountry): string | null {
  const q = normalizeQuery(name, country);
  if (!q) return null;
  const names = regionNames(country);
  const exact = names.find((p) => normalizeQuery(p, country) === q);
  if (exact) return exact;
  const prefixes = names.filter((p) => normalizeQuery(p, country).startsWith(q));
  if (prefixes.length === 1) return prefixes[0];
  return null;
}

export function resolveStructuredRegion(
  name: string,
  country: StructuredAddressCountry,
): string | null {
  const key = findRegionKey(name, country);
  return key ? displayLocationName(key, country) : null;
}

export function getDistrictsForStructuredRegion(
  regionName: string,
  country: StructuredAddressCountry,
): string[] {
  const key = findRegionKey(regionName, country);
  if (!key) return [];
  return getRegionMap(country)[key] ?? [];
}

export function getRegionInlineCompletion(
  query: string,
  country: StructuredAddressCountry,
): LocationInlineCompletion | null {
  return buildInlineCompletion(regionNames(country), query, country);
}

export function getDistrictInlineCompletion(
  query: string,
  regionName: string,
  country: StructuredAddressCountry,
): LocationInlineCompletion | null {
  const districts = getDistrictsForStructuredRegion(regionName, country);
  if (!districts.length) return null;
  return buildInlineCompletion(districts, query, country);
}

export function resolveStructuredDistrict(
  regionName: string,
  districtName: string,
  country: StructuredAddressCountry,
): string | null {
  const districts = getDistrictsForStructuredRegion(regionName, country);
  if (!districts.length) return null;
  const q = normalizeQuery(districtName, country);
  if (!q) return null;
  const exact = districts.find((d) => normalizeQuery(d, country) === q);
  if (exact) return displayLocationName(exact, country);
  const prefixes = districts.filter((d) => normalizeQuery(d, country).startsWith(q));
  if (prefixes.length === 1) return displayLocationName(prefixes[0], country);
  return null;
}

export function isTurkeyCountryName(country: string): boolean {
  const q = country.trim().toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
  if (!q) return false;
  if (q === 'türkiye' || q === 'turkiye' || q === 'turkey' || q === 'tr') return true;
  return q.includes('turkiye') || q.includes('türkiye');
}

export function resolveStructuredAddressCountry(
  countryName: string,
  identityCode?: IdentityDocumentCountry,
): StructuredAddressCountry | null {
  const trimmed = countryName.trim();
  if (
    !trimmed &&
    identityCode &&
    (STRUCTURED_ADDRESS_COUNTRY_CODES as readonly string[]).includes(identityCode)
  ) {
    return identityCode as StructuredAddressCountry;
  }
  if (!trimmed) return null;
  const format = resolveIdentityFormatCountryFromName(trimmed);
  if (format === 'OTHER') return null;
  if ((STRUCTURED_ADDRESS_COUNTRY_CODES as readonly string[]).includes(format)) {
    return format as StructuredAddressCountry;
  }
  return null;
}

export function resolveStructuredAddressCountryFromForm(
  billingCountry: string,
  identityCountryName: string,
  customerType: 'individual' | 'corporate',
  identityCode?: IdentityDocumentCountry,
): StructuredAddressCountry | null {
  if (customerType === 'individual' && identityCountryName.trim()) {
    const fromIdentity = resolveStructuredAddressCountry(identityCountryName, identityCode);
    if (fromIdentity) return fromIdentity;
  }
  if (isTurkeyCountryName(billingCountry)) return 'TR';
  return resolveStructuredAddressCountry(billingCountry, identityCode);
}
