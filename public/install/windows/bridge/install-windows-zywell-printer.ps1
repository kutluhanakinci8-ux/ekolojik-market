# Zywell / POS-80 — standart Windows yazıcı kuyruğu (ESC/POS ham yazdırma)
# install-windows-receipt-bridge.ps1 içinden çağrılır veya tek başına.
param(
  [string]$PrinterName = 'Ekolojik POS-80 (Zywell)'
)

$ErrorActionPreference = 'Stop'

function Write-Info($msg) { Write-Host $msg }

if (Get-Printer -Name $PrinterName -ErrorAction SilentlyContinue) {
  Write-Info "OK Yazici zaten var: $PrinterName"
  return $PrinterName
}

$existingPos = @(Get-Printer -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -match 'zywell|pos.?80|80mm|ekolojik' -and $_.Name -ne $PrinterName
  })
if ($existingPos.Count -eq 1) {
  Write-Info "Mevcut termal yazici bulundu: $($existingPos[0].Name) — standart ad kullanilacak: $PrinterName"
  $port = (Get-Printer -Name $existingPos[0].Name).PortName
} else {
  $usbPort = @(Get-PrinterPort -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^USB\d+$' })
  if ($usbPort.Count -eq 0) {
    $pnp = @(Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object {
        $_.FriendlyName -match 'Zywell|POS-?80|80mm|Thermal|Receipt'
      })
    if ($pnp.Count -eq 0) {
      Write-Warning @"
USB termal yazici portu bulunamadi.
1) Zywell USB kablosunu takin
2) Windows Ayarlar -> Bluetooth ve cihazlar -> Yazicilar -> Yazici ekle
3) Zywell / POS-80 surucusunu kurun (uretici CD veya Zywell sitesi)
4) Bu betigi tekrar calistirin
"@
      return $null
    }
    Write-Info "PnP cihaz var; yazici portu henuz yok — once Windows yazici ekleyin."
    $pnp | ForEach-Object { Write-Info "  - $($_.FriendlyName)" }
    return $null
  }
  $port = $usbPort[0].Name
}

$driverCandidates = @(
  'POS-80C',
  'POS-80',
  '80mm Series Printer',
  'Zywell POS-80',
  'Generic / Text Only'
)
$installed = @(Get-PrinterDriver -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
$driver = $null
foreach ($c in $driverCandidates) {
  if ($installed -contains $c) {
    $driver = $c
    break
  }
}
if (-not $driver) {
  foreach ($c in @('Generic / Text Only')) {
    try {
      Add-PrinterDriver -Name $c -ErrorAction Stop
      $driver = $c
      break
    } catch {
      Write-Verbose $_
    }
  }
}
if (-not $driver) {
  Write-Warning 'Uygun yazici surucusu bulunamadi. POS-80 / Zywell surucusunu kurun.'
  return $null
}

try {
  Add-Printer -Name $PrinterName -DriverName $driver -PortName $port -ErrorAction Stop
  Write-Info "OK Yazici eklendi: $PrinterName (surucu: $driver, port: $port)"
  return $PrinterName
} catch {
  Write-Warning "Add-Printer basarisiz: $($_.Exception.Message)"
  return $null
}
