# Greenleaf / Lima — Windows fiş köprüsü (127.0.0.1:18765, sessiz ESC/POS)
# USB POS-80C bu kasa PC'de; site tarayıcıdan açılır.
# Bir kez (normal PowerShell, yönetici gerekmez):
#   cd C:\...\ekolojik-market
#   .\scripts\install-windows-receipt-bridge.ps1
#   .\scripts\install-windows-receipt-bridge.ps1 -PrinterName "POS-80C"
param(
  [string]$PrinterName = '',
  [switch]$SkipZywellPrinterInstall
)

$StandardZywellName = 'Ekolojik POS-80 (Zywell)'

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$DestDir = Join-Path $env:USERPROFILE '.greenleaf-market-pos'
$TaskName = 'LimaMarketReceiptBridge'
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source

if (-not $Node) {
  Write-Error 'Node.js bulunamadi — https://nodejs.org (LTS) kurun, sonra bu betigi tekrar calistirin.'
}

$files = @(
  'lima-raw-print-bridge.mjs',
  'escposTurkish.mjs',
  'win-raw-escpos.ps1'
)
New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
foreach ($f in $files) {
  $src = Join-Path $RepoRoot "scripts\$f"
  if (-not (Test-Path -LiteralPath $src)) {
    Write-Error "Dosya eksik: $src — ekolojik-market repo klasorunden calistirin."
  }
  Copy-Item -LiteralPath $src -Destination (Join-Path $DestDir $f) -Force
}

if (-not $SkipZywellPrinterInstall) {
  $zyScript = Join-Path $RepoRoot 'scripts\install-windows-zywell-printer.ps1'
  if (Test-Path -LiteralPath $zyScript) {
    $created = & $zyScript -PrinterName $StandardZywellName
    if ($created) { $PrinterName = $created }
  }
}

$printers = @(Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
if (-not $PrinterName) {
  if ($printers -contains $StandardZywellName) {
    $PrinterName = $StandardZywellName
  }
  $pos80 = @($printers | Where-Object { $_ -match 'pos.?80|zywell|ekolojik' })
  if ($pos80.Count -eq 1) {
    $PrinterName = $pos80[0]
  } elseif ($pos80.Count -gt 1) {
    $PrinterName = $pos80[0]
    Write-Host "Birden fazla POS-80 yazici; ilk secildi: $PrinterName"
    Write-Host "Farkli ad icin: -PrinterName `"tam ad`""
  } else {
    $PrinterName = $StandardZywellName
    Write-Host "POS-80/Zywell otomatik bulunamadi; standart ad: $PrinterName"
    Write-Host "Ayarlar -> Fiş yazicisi adini Windows'taki tam adla ayni yapin."
  }
}

$startCmd = @"
@echo off
set POS80_QUEUE_NAME=$PrinterName
set ESCPOS_CHARSET=ascii
set ESCPOS_FEED_LINES=10
set LIMA_RAW_PRINT_PORT=18765
cd /d "$DestDir"
"$Node" lima-raw-print-bridge.mjs
"@

$launcher = Join-Path $DestDir 'start-receipt-bridge.cmd'
Set-Content -LiteralPath $launcher -Value $startCmd -Encoding ASCII

$action = New-ScheduledTaskAction -Execute $launcher -WorkingDirectory $DestDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
[System.Environment]::SetEnvironmentVariable('POS80_QUEUE_NAME', $PrinterName, 'User')

Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
  try { $_.Path -eq $Node } catch { $false }
} | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1
Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:18765/health' -TimeoutSec 5
  Write-Host "OK Fiş servisi calisiyor: $($health | ConvertTo-Json -Compress)"
} catch {
  Write-Host "UYARI: http://127.0.0.1:18765 yanit vermedi. Elle deneyin:"
  Write-Host "  $launcher"
}

Write-Host ""
Write-Host "Yazici adi (Ayarlar + bu PC): $PrinterName"
if ($printers.Count -gt 0) {
  Write-Host "Windows yazicilari:"
  $printers | ForEach-Object { Write-Host "  - $_" }
}
Write-Host "Teşhis: .\scripts\diag-windows-receipt-bridge.ps1"
