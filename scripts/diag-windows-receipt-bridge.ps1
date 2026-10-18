# Fiş köprüsü teşhis — Windows kasa PC
$ErrorActionPreference = 'Continue'
Write-Host "=== Lima fiş köprüsü (Windows) ==="

$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) { Write-Host "Node: $($node.Source)" } else { Write-Host "HATA: node yok — https://nodejs.org" }

Write-Host "`nYazicilar (Ayarlar'daki ad bunlardan biri olmali):"
Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  - $($_.Name)" }

$dest = Join-Path $env:USERPROFILE '.greenleaf-market-pos'
Write-Host "`nKurulum klasoru: $dest"
@('lima-raw-print-bridge.mjs', 'escposTurkish.mjs', 'win-raw-escpos.ps1', 'start-receipt-bridge.cmd') | ForEach-Object {
  $p = Join-Path $dest $_
  Write-Host "  $(if (Test-Path $p) { 'OK' } else { '--' }) $_"
}

Write-Host "`nGorev: EkolojikMarketReceiptBridge"
Get-ScheduledTask -TaskName 'EkolojikMarketReceiptBridge' -ErrorAction SilentlyContinue | Format-List TaskName, State
Write-Host "POS80_QUEUE_NAME (kullanici): $([Environment]::GetEnvironmentVariable('POS80_QUEUE_NAME','User'))"

Write-Host "Health:"
try {
  Invoke-RestMethod -Uri 'http://127.0.0.1:18765/health' -TimeoutSec 3 | ConvertTo-Json
} catch {
  Write-Host "  KAPALI — install-windows-receipt-bridge.ps1 calistirin veya:"
  Write-Host "  $dest\start-receipt-bridge.cmd"
}
