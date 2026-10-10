# Lima fiş köprüsünü Windows oturum açılışında başlatır (sessiz yazdırma).
param(
  [string]$PrinterName = 'Printer POS-80C'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $Node) {
  Write-Error 'node bulunamadı — Node.js kurun.'
}
$Bridge = Join-Path $RepoRoot 'scripts\lima-raw-print-bridge.mjs'
$TaskName = 'LimaMarketReceiptBridge'

$action = New-ScheduledTaskAction -Execute $Node -Argument "`"$Bridge`"" -WorkingDirectory $RepoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
[System.Environment]::SetEnvironmentVariable('POS80_QUEUE_NAME', $PrinterName, 'User')
Write-Host "Görev kaydedildi: $TaskName (yazici: $PrinterName). Oturumu kapat-ac veya görevi çalıştır."
