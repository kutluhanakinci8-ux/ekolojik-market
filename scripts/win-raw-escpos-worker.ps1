# Sürekli çalışır — Add-Type bir kez; fişler stdin JSON satırı ile gelir.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'win-raw-escpos-lib.ps1')

[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $trim = $line.Trim()
  if ($trim -eq '') { continue }
  try {
    $job = $trim | ConvertFrom-Json
    Send-LimaRawEscPosFile -PrinterName $job.printer -FilePath $job.file
    [Console]::Out.WriteLine('OK')
  } catch {
    $msg = $_.Exception.Message -replace "[\r\n]+", ' '
    [Console]::Out.WriteLine("ERR $msg")
  }
  [Console]::Out.Flush()
}
