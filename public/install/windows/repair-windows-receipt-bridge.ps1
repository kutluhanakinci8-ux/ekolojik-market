# Eksik köprü dosyalarını indirir ve fiş servisini yeniden başlatır (eski kurulum .ps1 için)
$ErrorActionPreference = 'Stop'
$BaseUrl = 'https://www.ekolojikmarket.com.tr'
$DestDir = Join-Path $env:USERPROFILE '.greenleaf-market-pos'
$TaskName = 'EkolojikMarketReceiptBridge'
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
$files = @(
  'lima-raw-print-bridge.mjs',
  'escposTurkish.mjs',
  'win-raw-escpos.ps1',
  'win-raw-escpos-lib.ps1',
  'win-raw-escpos-worker.ps1',
  'install-windows-zywell-printer.ps1'
)
foreach ($f in $files) {
  $url = "$BaseUrl/install/windows/bridge/$f"
  $out = Join-Path $DestDir $f
  Write-Host "Indiriliyor: $f"
  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
}
try {
  Get-NetTCPConnection -LocalPort 18765 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
  }
} catch { }
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 4
$h = Invoke-RestMethod -Uri 'http://127.0.0.1:18765/health' -TimeoutSec 8
Write-Host "OK health: $($h | ConvertTo-Json -Compress)"
if (-not $h.bridgeVersion) {
  Write-Host 'UYARI: bridgeVersion yok — lima-raw-print-bridge.mjs eski olabilir; gorev yeniden baslatildi mi kontrol edin.'
} elseif ($h.fastPrintWorker -and -not $h.workerReady) {
  Write-Host 'Worker hazirlaniyor; 10 sn bekleyip test fis deneyin.'
}
Write-Host "Dosyalar: $DestDir"
