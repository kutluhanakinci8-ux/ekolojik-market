#!/usr/bin/env node
/** Faz 52 — kapanış artefaktleri ve plan checklist */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const mustExist = [
  'docs/RAKIP-SKOR-KARTI.md',
  'docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md',
  'docs/EKOLOJIK-POSTA-PARITE-TAMAMLANDI.md',
  'scripts/sunucu-ekolojik-posta-wave3-dogrula.sh',
  'scripts/sunucu-ekolojik-posta-tam-kabul.sh',
  '.github/workflows/ci.yml',
];

for (const rel of mustExist) {
  try {
    await readFile(join(REPO, rel));
    console.log(`OK    ${rel}`);
  } catch {
    console.error(`FAIL  missing ${rel}`);
    process.exit(1);
  }
}

const plan = await readFile(join(REPO, 'docs/PLAN-POSTA-MESAJ-100-PARITE.md'), 'utf8');
const waveBlock = plan.match(/## Wave 3 master checklist[\s\S]*?```/);
if (!waveBlock) {
  console.error('FAIL  Wave 3 master checklist not found');
  process.exit(1);
}
const openFaz = waveBlock[0].match(/\[ \] Faz/g);
if (openFaz?.length) {
  console.error(`FAIL  ${openFaz.length} open faz item(s) in master checklist`);
  process.exit(1);
}
console.log('OK    Wave 3 master checklist — all [x]');

const tamam = await readFile(join(REPO, 'docs/EKOLOJIK-POSTA-PARITE-TAMAMLANDI.md'), 'utf8');
if (!/Wave 3.*kapandı|Wave 3.*kapan/i.test(tamam)) {
  console.error('FAIL  PARITE-TAMAMLANDI should state Wave 3 closure');
  process.exit(1);
}
console.log('OK    EKOLOJIK-POSTA-PARITE-TAMAMLANDI.md');

console.log('\nFaz 52 closure smoke: PASS');
