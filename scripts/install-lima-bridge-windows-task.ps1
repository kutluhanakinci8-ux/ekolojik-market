# Eski ad — install-windows-receipt-bridge.ps1 kullanin
param([string]$PrinterName = '')
& (Join-Path $PSScriptRoot 'install-windows-receipt-bridge.ps1') @PSBoundParameters
