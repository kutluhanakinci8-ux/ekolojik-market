#!/usr/bin/env node
/**
 * Bozuk MyMemory çevirilerini düzeltir (sözlük tabanlı, API gerektirmez).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  glossaryTranslate,
  isBadTranslation,
  splitFeatureBullets,
} from './ruTrGlossary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(__dirname, '../src/data/greenleafShopProducts.json');

function cleanField(value) {
  if (!value || isBadTranslation(value)) return '';
  return value.trim();
}

function repairProduct(product) {
  const nameTr = cleanField(product.nameTr) || glossaryTranslate(product.name);
  const descriptionTr = cleanField(product.descriptionTr)
    || (product.description ? glossaryTranslate(product.description) : '');

  let featuresTr = (product.featuresTr ?? []).filter((f) => !isBadTranslation(f));
  if (featuresTr.length === 0 && product.features?.length) {
    const bullets = product.features.flatMap(splitFeatureBullets);
    featuresTr = bullets.map((b) => glossaryTranslate(b)).filter((b) => b.length > 8);
  }

  return {
    ...product,
    nameTr,
    descriptionTr,
    featuresTr,
  };
}

const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8'));
let repaired = 0;

raw.products = raw.products.map((p) => {
  const needs =
    isBadTranslation(p.nameTr)
    || isBadTranslation(p.descriptionTr)
    || (p.featuresTr ?? []).some(isBadTranslation);
  if (needs) repaired++;
  return repairProduct(p);
});

raw.translatedAt = new Date().toISOString();
raw.locale = 'tr';
raw.translationMethod = 'glossary';

writeFileSync(DATA_FILE, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
console.log(`✓ ${repaired} ürün düzeltildi → ${DATA_FILE}`);
