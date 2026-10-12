#!/usr/bin/env node
/**
 * Windows Zywell kurulum dosyalarını public/ altına kopyalar (Vite → dist).
 */
import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const OUT_BRIDGE = join(REPO, 'public', 'install', 'windows', 'bridge');
const OUT_SETUP = join(REPO, 'public', 'install', 'windows', 'ekolojik-zywell-setup.ps1');
const OUT_REPAIR = join(REPO, 'public', 'install', 'windows', 'repair-windows-receipt-bridge.ps1');

const BRIDGE_FILES = [
  'lima-raw-print-bridge.mjs',
  'escposTurkish.mjs',
  'win-raw-escpos.ps1',
  'win-raw-escpos-lib.ps1',
  'win-raw-escpos-worker.ps1',
  'install-windows-zywell-printer.ps1',
];

async function main() {
  await mkdir(OUT_BRIDGE, { recursive: true });
  for (const f of BRIDGE_FILES) {
    await copyFile(join(REPO, 'scripts', f), join(OUT_BRIDGE, f));
  }
  await copyFile(join(REPO, 'scripts', 'ekolojik-zywell-setup.ps1'), OUT_SETUP);
  await copyFile(join(REPO, 'scripts', 'repair-windows-receipt-bridge.ps1'), OUT_REPAIR);
  console.log('OK public/install/windows (Zywell kurulum paketi)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
