#!/usr/bin/env node
/**
 * Mac/Windows ayrı POS sürümü olmamalı — tek package.json + tek app-release.json.
 */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');

const pkg = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'));
const vite = readFileSync(join(REPO, 'vite.config.ts'), 'utf8');
const posApp = readFileSync(join(REPO, 'src/PosApp.tsx'), 'utf8');
const indexHtml = readFileSync(join(REPO, 'index.html'), 'utf8');

assert.match(vite, /pkg\.version/, 'vite.config.ts must read version from package.json only');
assert.ok(!vite.includes('darwin') && !vite.includes('win32'), 'vite build must not branch on OS');

const forbidden = ['APP_FEATURE_TAG', 'WINDOWS_APP_VERSION', 'MAC_APP_VERSION', 'platformVersion'];
for (const token of forbidden) {
  for (const rel of ['src/version.ts', 'src/PosApp.tsx', 'vite.config.ts']) {
    const body = readFileSync(join(REPO, rel), 'utf8');
    assert.ok(!body.includes(token), `${rel} must not define ${token}`);
  }
}

assert.ok(posApp.includes('useAppReleaseRefresh'), 'PosApp must auto-refresh when server build changes');
assert.ok(indexHtml.includes('app-release.json'), 'index.html must sync build from app-release.json');
assert.ok(indexHtml.includes('www.ekolojikmarket.com.tr'), 'index.html must enforce www canonical host');

assert.ok(existsSync(join(REPO, 'src/config/canonicalSite.ts')), 'canonicalSite.ts required');

console.log(`single-version smoke: PASS (app ${pkg.version})`);
