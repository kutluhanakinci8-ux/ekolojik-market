import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '../src/data/turkeyProvinceDistricts.json');

const res = await fetch('https://turkiyeapi.dev/api/v1/provinces');
if (!res.ok) {
  throw new Error(`turkiyeapi.dev failed: ${res.status}`);
}
const json = await res.json();
const map = {};
for (const province of json.data) {
  const districts = province.districts
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, 'tr-TR'));
  map[province.name] = districts;
}
const sortedKeys = Object.keys(map).sort((a, b) => a.localeCompare(b, 'tr-TR'));
const sorted = {};
for (const key of sortedKeys) {
  sorted[key] = map[key];
}
await writeFile(outPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
console.log(`Wrote ${sortedKeys.length} provinces → ${outPath}`);
