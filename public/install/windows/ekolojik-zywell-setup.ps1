# Ekolojik Market — Zywell POS-80 + fiş köprüsü (Windows, bir kez)
# Kullanıcı terminal açmaz; oturum açılışında arka planda çalışır.
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
$files = @('lima-raw-print-bridge.mjs', 'escposTurkish.mjs', 'win-raw-escpos.ps1', 'install-windows-zywell-printer.ps1')
foreach ($f in $files) {
  $url = "$BaseUrl/install/windows/bridge/$f"
  $out = Join-Path $DestDir $f
  Write-Host "Indiriliyor: $f"
  Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing
}

function Resolve-PosPrinterName {
  $list = @(Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
  if (-not $list.Count) {
    try {
      $list = @(Get-CimInstance Win32_Printer -ErrorAction Stop | ForEach-Object { $_.Name })
    } catch {
      $list = @()
    }
  }
  foreach ($prefer in @('POS-80C', 'POS-80', $StandardPrinter)) {
    if ($list -contains $prefer) { return $prefer }
  }
  $hit = $list | Where-Object { $_ -match 'POS-80C' } | Select-Object -First 1
  if ($hit) { return $hit }
  $hit = $list | Where-Object { $_ -match 'POS-80|Zywell|80mm|Ekolojik' } | Select-Object -First 1
  if ($hit) { return $hit }
  $zyScript = Join-Path $DestDir 'install-windows-zywell-printer.ps1'
  $created = & $zyScript -PrinterName $StandardPrinter
  if ($created) { return $created }
  return $StandardPrinter
}

$printer = Resolve-PosPrinterName
[System.Environment]::SetEnvironmentVariable('POS80_QUEUE_NAME', $printer, 'User')

$bridgeJs = Join-Path $DestDir 'lima-raw-print-bridge.mjs'
$vbsPath = Join-Path $DestDir 'start-receipt-bridge-hidden.vbs'
$vbs = @"
Set sh = CreateObject("WScript.Shell")
Set env = sh.Environment("PROCESS")
env("POS80_QUEUE_NAME") = "$printer"
env("ESCPOS_CHARSET") = "ascii"
env("ESCPOS_FEED_LINES") = "10"
env("LIMA_RAW_PRINT_PORT") = "18765"
sh.CurrentDirectory = "$($DestDir.Replace('\', '\\'))"
sh.Run Chr(34) & "$($Node.Replace('\', '\\'))" & Chr(34) & " " & Chr(34) & "$($bridgeJs.Replace('\', '\\'))" & Chr(34), 0, False
"@
Set-Content -LiteralPath $vbsPath -Value $vbs -Encoding ASCII

function Stop-ReceiptBridgeOnPort {
  try {
    $conns = Get-NetTCPConnection -LocalPort 18765 -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
    }
  } catch {
    # ignore
  }
}

Stop-ReceiptBridgeOnPort

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "//B `"$vbsPath`"" -WorkingDirectory $DestDir
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -RestartCount 5 `
  -RestartInterval (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
  -Description 'Ekolojik Market fiş servisi — arka plan, pencere yok' -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
if (-not (Get-NetTCPConnection -LocalPort 18765 -State Listen -ErrorAction SilentlyContinue)) {
  wscript.exe //B "$vbsPath"
  Start-Sleep -Seconds 2
}

try {
  $h = Invoke-RestMethod -Uri 'http://127.0.0.1:18765/health' -TimeoutSec 8
  Write-Host "OK Fiş servisi arka planda calisiyor: $($h | ConvertTo-Json -Compress)"
} catch {
  Write-Host 'UYARI: Servis henuz yanit vermedi. Bilgisayari bir kez yeniden baslatin veya bir dakika bekleyip test fiş deneyin.'
}

Write-Host "Yazici (POS Ayarlari): $printer"
Write-Host 'Kurulum tamam. Oturum acilisinda otomatik baslar — terminal gerekmez.'
