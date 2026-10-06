import type { IdentityDocumentCountry } from '../types/business';
import { IDENTITY_DOCUMENT_COUNTRY_OPTIONS } from '../types/business';

export type IdentityFormatCountry = IdentityDocumentCountry | 'OTHER';

const SPECIAL_ALIASES: Record<IdentityDocumentCountry, string[]> = {
  TR: ['turkiye', 'türkiye', 'turkey'],
  RU: ['rusya', 'russia', 'rus'],
  KZ: ['kazakistan', 'kazakhstan', 'kazak'],
  UZ: ['özbekistan', 'ozbekistan', 'uzbekistan', 'özbek', 'ozbek'],
  TM: ['türkmenistan', 'turkmenistan', 'turkmen'],
  KG: ['kırgızistan', 'kirgizistan', 'kyrgyzstan', 'kirgiz'],
  AZ: ['azerbaycan', 'azerbaijan'],
  AM: ['ermenistan', 'armenia'],
  TJ: ['tacikistan', 'tajikistan'],
  GE: ['gürcistan', 'gurcistan', 'georgia'],
  UA: ['ukrayna', 'ukraine'],
  MD: ['moldova', 'moldavia'],
  BY: ['belarus', 'beyaz rusya', 'beyazrusya'],
  EE: ['estonya', 'estonia'],
  LV: ['letonya', 'latvia'],
  LT: ['litvanya', 'lithuania'],
};

/** Kimlik formatı tanımlı ülkeler dışındaki ülke adları (Türkçe) */
const OTHER_COUNTRIES_TR: string[] = [
  'Afganistan',
  'Almanya',
  'Amerika Birleşik Devletleri',
  'Andorra',
  'Angola',
  'Antigua ve Barbuda',
  'Arjantin',
  'Arnavutluk',
  'Avustralya',
  'Avusturya',
  'Azerbaycan',
  'Bahamalar',
  'Bahreyn',
  'Bangladeş',
  'Barbados',
  'Belarus',
  'Belçika',
  'Belize',
  'Benin',
  'Bhutan',
  'Birleşik Arap Emirlikleri',
  'Bolivya',
  'Bosna-Hersek',
  'Botsvana',
  'Brezilya',
  'Brunei',
  'Bulgaristan',
  'Burkina Faso',
  'Burundi',
  'Cezayir',
  'Cibuti',
  'Çad',
  'Çekya',
  'Çin',
  'Danimarka',
  'Dominik Cumhuriyeti',
  'Dominika',
  'Ekvador',
  'Ekvator Ginesi',
  'El Salvador',
  'Endonezya',
  'Eritre',
  'Ermenistan',
  'Estonya',
  'Esvatini',
  'Etiyopya',
  'Fas',
  'Fiji',
  'Filipinler',
  'Finlandiya',
  'Fransa',
  'Gabon',
  'Gambiya',
  'Gana',
  'Gine',
  'Gine-Bissau',
  'Grenada',
  'Guatemala',
  'Guyana',
  'Güney Afrika',
  'Güney Kore',
  'Güney Sudan',
  'Gürcistan',
  'Haiti',
  'Hırvatistan',
  'Hindistan',
  'Hollanda',
  'Honduras',
  'Irak',
  'İngiltere',
  'İran',
  'İrlanda',
  'İspanya',
  'İsrail',
  'İsveç',
  'İsviçre',
  'İtalya',
  'İzlanda',
  'Jamaika',
  'Japonya',
  'Kamboçya',
  'Kamerun',
  'Kanada',
  'Karadağ',
  'Katar',
  'Kenya',
  'Kıbrıs',
  'Kiribati',
  'Kolombiya',
  'Komorlar',
  'Kongo Cumhuriyeti',
  'Kongo Demokratik Cumhuriyeti',
  'Kosta Rika',
  'Kuveyt',
  'Küba',
  'Laos',
  'Lesotho',
  'Letonya',
  'Liberya',
  'Libya',
  'Liechtenstein',
  'Litvanya',
  'Lübnan',
  'Lüksemburg',
  'Macaristan',
  'Madagaskar',
  'Makedonya',
  'Malavi',
  'Maldivler',
  'Malezya',
  'Mali',
  'Malta',
  'Marshall Adaları',
  'Mauritius',
  'Meksika',
  'Mısır',
  'Mikronezya',
  'Moğolistan',
  'Moldova',
  'Monako',
  'Moritanya',
  'Mozambik',
  'Myanmar',
  'Namibya',
  'Nauru',
  'Nepal',
  'Nijer',
  'Nijerya',
  'Nikaragua',
  'Norveç',
  'Oman',
  'Pakistan',
  'Palau',
  'Panama',
  'Papua Yeni Gine',
  'Paraguay',
  'Peru',
  'Polonya',
  'Portekiz',
  'Romanya',
  'Ruanda',
  'Saint Kitts ve Nevis',
  'Saint Lucia',
  'Saint Vincent ve Grenadinler',
  'Samoa',
  'San Marino',
  'Sao Tome ve Principe',
  'Senegal',
  'Seyşeller',
  'Sierra Leone',
  'Singapur',
  'Slovakya',
  'Slovenya',
  'Solomon Adaları',
  'Somali',
  'Sri Lanka',
  'Sudan',
  'Surinam',
  'Suriye',
  'Suudi Arabistan',
  'Şili',
  'Tacikistan',
  'Tanzanya',
  'Tayland',
  'Tayvan',
  'Togo',
  'Tonga',
  'Trinidad ve Tobago',
  'Tunus',
  'Tuvalu',
  'Uganda',
  'Ukrayna',
  'Umman',
  'Uruguay',
  'Ürdün',
  'Vanuatu',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Yeni Zelanda',
  'Yeşil Burun Adaları',
  'Yunanistan',
  'Zambiya',
  'Zimbabve',
];

const SPECIAL_LABELS = new Set(IDENTITY_DOCUMENT_COUNTRY_OPTIONS.map((o) => o.label));

interface CountryCatalogEntry {
  label: string;
  formatCountry: IdentityFormatCountry;
}

const COUNTRY_CATALOG: CountryCatalogEntry[] = [
  ...IDENTITY_DOCUMENT_COUNTRY_OPTIONS.map((opt) => ({
    label: opt.label,
    formatCountry: opt.code as IdentityFormatCountry,
  })),
  ...OTHER_COUNTRIES_TR.filter((name) => !SPECIAL_LABELS.has(name)).map((name) => ({
    label: name,
    formatCountry: 'OTHER' as IdentityFormatCountry,
  })),
];

function normalizeCountryQuery(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

/** Kimlik ülkesi alanı — kullanıcı küçük harf yazsa da büyük harf */
export function formatIdentityCountryNameInput(value: string): string {
  return value.toLocaleUpperCase('tr-TR');
}

function displayCountryNameFromCatalog(catalogLabel: string): string {
  return formatIdentityCountryNameInput(catalogLabel);
}

function inlineCompletionFromCatalog(
  catalogLabel: string,
  typed: string,
  formatCountry: IdentityFormatCountry,
  uniquePrefix: boolean,
): CountryInlineCompletion {
  const fullLabel = displayCountryNameFromCatalog(catalogLabel);
  const typedUpper = formatIdentityCountryNameInput(typed);
  const suffix =
    isNormalizedPrefixOfLabel(typedUpper, catalogLabel) && typedUpper.length < fullLabel.length
      ? fullLabel.slice(typedUpper.length)
      : '';
  return { fullLabel, suffix, formatCountry, uniquePrefix };
}

function isNormalizedPrefixOfLabel(query: string, label: string): boolean {
  const q = normalizeCountryQuery(query);
  const l = normalizeCountryQuery(label);
  return q.length > 0 && l.startsWith(q);
}

function rankCountryCandidates(query: string): CountryCatalogEntry[] {
  const q = normalizeCountryQuery(query);
  if (!q) return [];

  const weighted: { entry: CountryCatalogEntry; weight: number }[] = [];

  for (const entry of COUNTRY_CATALOG) {
    const labelNorm = normalizeCountryQuery(entry.label);
    if (labelNorm.startsWith(q)) {
      const weight =
        10_000 +
        q.length * 200 -
        entry.label.length +
        (entry.formatCountry !== 'OTHER' ? 80 : 0);
      weighted.push({ entry, weight });
      continue;
    }
    if (labelNorm.includes(q)) {
      weighted.push({
        entry,
        weight: 500 + q.length * 10 - (labelNorm.indexOf(q) * 2),
      });
    }
  }

  for (const opt of IDENTITY_DOCUMENT_COUNTRY_OPTIONS) {
    const aliases = SPECIAL_ALIASES[opt.code];
    for (const alias of aliases) {
      if (alias.startsWith(q) || q.startsWith(alias)) {
        weighted.push({
          entry: { label: opt.label, formatCountry: opt.code },
          weight: 8_000 + q.length * 150,
        });
      } else if (alias.includes(q)) {
        weighted.push({
          entry: { label: opt.label, formatCountry: opt.code },
          weight: 400 + q.length * 8,
        });
      }
    }
  }

  weighted.sort((a, b) => b.weight - a.weight);

  const seen = new Set<string>();
  const ranked: CountryCatalogEntry[] = [];
  for (const item of weighted) {
    if (seen.has(item.entry.label)) continue;
    seen.add(item.entry.label);
    ranked.push(item.entry);
  }
  return ranked;
}

function collectLabelPrefixMatches(query: string): CountryCatalogEntry[] {
  const q = normalizeCountryQuery(query);
  if (!q) return [];
  return COUNTRY_CATALOG.filter((entry) => normalizeCountryQuery(entry.label).startsWith(q));
}

export interface CountryInlineCompletion {
  fullLabel: string;
  suffix: string;
  formatCountry: IdentityFormatCountry;
  /** Yalnızca tek ülke adı bu önek ile başlıyorsa otomatik tamamlanır */
  uniquePrefix: boolean;
}

/** Açılır liste yerine alan içi tamamlama için en olası ülke */
export function getCountryInlineCompletion(query: string): CountryInlineCompletion | null {
  const trimmed = query;
  const q = normalizeCountryQuery(trimmed);
  if (!q) return null;

  const exact = COUNTRY_CATALOG.find((e) => normalizeCountryQuery(e.label) === q);
  if (exact) {
    return inlineCompletionFromCatalog(exact.label, trimmed, exact.formatCountry, true);
  }

  for (const opt of IDENTITY_DOCUMENT_COUNTRY_OPTIONS) {
    const aliases = SPECIAL_ALIASES[opt.code];
    if (aliases.some((a) => a === q)) {
      return inlineCompletionFromCatalog(opt.label, trimmed, opt.code, true);
    }
  }

  const prefixMatches = collectLabelPrefixMatches(trimmed);
  const ranked = rankCountryCandidates(trimmed);
  const best = ranked[0];
  if (!best) return null;

  if (isNormalizedPrefixOfLabel(trimmed, best.label)) {
    const uniquePrefix = prefixMatches.length === 1;
    return inlineCompletionFromCatalog(best.label, trimmed, best.formatCountry, uniquePrefix);
  }

  const aliasOnly = ranked.filter((entry) => {
    if (isNormalizedPrefixOfLabel(trimmed, entry.label)) return false;
    if (entry.formatCountry === 'OTHER') return false;
    const aliases = SPECIAL_ALIASES[entry.formatCountry];
    return aliases.some((alias) => alias.startsWith(q) || q.startsWith(alias));
  });
  if (aliasOnly.length === 1) {
    const entry = aliasOnly[0];
    return inlineCompletionFromCatalog(entry.label, trimmed, entry.formatCountry, true);
  }

  return null;
}

export function resolveIdentityFormatCountryFromName(
  name: string,
): IdentityFormatCountry {
  const trimmed = name.trim();
  if (!trimmed) return 'TR';

  const q = normalizeCountryQuery(trimmed);

  for (const opt of IDENTITY_DOCUMENT_COUNTRY_OPTIONS) {
    if (normalizeCountryQuery(opt.label) === q) return opt.code;
    const aliases = SPECIAL_ALIASES[opt.code];
    if (aliases.some((a) => a === q)) return opt.code;
  }

  for (const other of OTHER_COUNTRIES_TR) {
    if (normalizeCountryQuery(other) === q) return 'OTHER';
  }

  const inline = getCountryInlineCompletion(trimmed);
  if (inline && (inline.suffix || inline.uniquePrefix)) {
    if (
      isNormalizedPrefixOfLabel(trimmed, inline.fullLabel) ||
      normalizeCountryQuery(inline.fullLabel) === q
    ) {
      return inline.formatCountry;
    }
  }

  return 'OTHER';
}

export function getIdentityCountryDisplayLabel(
  code?: IdentityDocumentCountry,
  name?: string,
): string {
  if (name?.trim()) return formatIdentityCountryNameInput(name);
  const opt = IDENTITY_DOCUMENT_COUNTRY_OPTIONS.find((o) => o.code === code);
  return displayCountryNameFromCatalog(opt?.label ?? 'Türkiye');
}
