@echo off
setlocal
cd /d "%~dp0.."
if not defined POS80_QUEUE_NAME set "POS80_QUEUE_NAME=Printer POS-80C"
if not defined ESCPOS_CHARSET set "ESCPOS_CHARSET=ascii"
echo Lima fis koprusu — yazici: %POS80_QUEUE_NAME%
echo Kalici kurulum: scripts\install-windows-receipt-bridge.ps1
node scripts\lima-raw-print-bridge.mjs
pause
