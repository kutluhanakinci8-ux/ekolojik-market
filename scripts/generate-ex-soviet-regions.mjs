import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../src/data/exSovietRegionCities.json');

const SOURCE_URL =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries%2Bstates%2Bcities.json';

const COUNTRY_NAMES = {
  TM: 'Turkmenistan',
  AZ: 'Azerbaijan',
  UA: 'Ukraine',
  RU: 'Russia',
  BY: 'Belarus',
  EE: 'Estonia',
  LV: 'Latvia',
  LT: 'Lithuania',
  KG: 'Kyrgyzstan',
  UZ: 'Uzbekistan',
  KZ: 'Kazakhstan',
};

const res = await fetch(SOURCE_URL);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const all = await res.json();

const out = {};
for (const [code, countryName] of Object.entries(COUNTRY_NAMES)) {
  const entry = all.find((c) => c.name === countryName);
  if (!entry?.states?.length) {
    console.warn('No states for', code, countryName);
    continue;
  }
  const map = {};
  for (const state of entry.states) {
    const cities = (state.cities ?? [])
      .map((c) => c.name)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'en'));
    if (cities.length === 0) continue;
    map[state.name] = cities;
  }
  const keys = Object.keys(map).sort((a, b) => a.localeCompare(b, 'en'));
  const sorted = {};
  for (const key of keys) sorted[key] = map[key];
  out[code] = sorted;
}

await writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
const sizes = Object.entries(out).map(([k, v]) => `${k}:${Object.keys(v).length} bölgeler`);
console.log(`Wrote ${outPath}`);
console.log(sizes.join(', '));
