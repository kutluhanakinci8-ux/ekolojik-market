#!/usr/bin/env node
/**
 * Windows Zywell kurulum dosyalarını public/ altına kopyalar (Vite → dist).
 */
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const OUT_BRIDGE = join(REPO, 'public', 'install', 'windows', 'bridge');
const OUT_SETUP = join(REPO, 'public', 'install', 'windows', 'ekolojik-zywell-setup.ps1');

const BRIDGE_FILES = [
  'lima-raw-print-bridge.mjs',
  'escposTurkish.mjs',
  'win-raw-escpos.ps1',
  'install-windows-zywell-printer.ps1',
];

const SETUP_PS1 = `# Ekolojik Market — Zywell POS-80 + fiş köprüsü (Windows, bir kez)
# Site: Ayarlar -> Fiş yazicisi -> "Zywell kurulumunu indir" veya bu dosyayi sag tik -> PowerShell ile Calistir
$ErrorActionPreference = 'Stop'
$BaseUrl = if ($env:EKOLOJIK_APP_ORIGIN) { $env:EKOLOJIK_APP_ORIGIN.TrimEnd('/') } else { 'https://www.ekolojikmarket.com.tr' }
$StandardPrinter = 'Ekolojik POS-80 (Zywell)'
$DestDir = Join-Path $env:USERPROFILE '.greenleaf-market-pos'
$TaskName = 'EkolojikMarketReceiptBridge'
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  Write-Host 'Node.js LTS gerekli: https://nodejs.org — kurun ve bu betigi tekrar calistirin.'
  exit 1
}
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
$files = @('lima-raw-print-bridge.mjs','escposTurkish.mjs','win-raw-escpos.ps1','install-windows-zywell-printer.ps1')
foreach ($f in $files) {
  $url = "$BaseUrl/install/windows/bridge/$f"
  $out = Join-Path $DestDir $f
  Write-Host "Indiriliyor: $f"
  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
}
$zyScript = Join-Path $DestDir 'install-windows-zywell-printer.ps1'
$printer = & $zyScript -PrinterName $StandardPrinter
if (-not $printer) { $printer = $StandardPrinter }
$launcher = Join-Path $DestDir 'start-receipt-bridge.cmd'
$startCmd = @"
@echo off
set POS80_QUEUE_NAME=$printer
set ESCPOS_CHARSET=ascii
set ESCPOS_FEED_LINES=10
set LIMA_RAW_PRINT_PORT=18765
cd /d "$DestDir"
"$Node" lima-raw-print-bridge.mjs
"@
Set-Content -LiteralPath $launcher -Value $startCmd -Encoding ASCII
$action = New-ScheduledTaskAction -Execute $launcher -WorkingDirectory $DestDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
[System.Environment]::SetEnvironmentVariable('POS80_QUEUE_NAME', $printer, 'User')
Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
try {
  $h = Invoke-RestMethod -Uri 'http://127.0.0.1:18765/health' -TimeoutSec 5
  Write-Host "OK Fiş servisi: $($h | ConvertTo-Json -Compress)"
} catch {
  Write-Host 'UYARI: Köprü henüz yanıt vermedi — PC yeniden başlatın veya start-receipt-bridge.cmd'
}
Write-Host "Yazici adi (POS Ayarlari): $printer"
Write-Host 'Kurulum tamam. Tarayicida www.ekolojikmarket.com.tr/app acin.'
`;

async function main() {
  await mkdir(OUT_BRIDGE, { recursive: true });
  for (const f of BRIDGE_FILES) {
    await copyFile(join(REPO, 'scripts', f), join(OUT_BRIDGE, f));
  }
  await writeFile(OUT_SETUP, SETUP_PS1, 'utf8');
  console.log('OK public/install/windows (Zywell kurulum paketi)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
