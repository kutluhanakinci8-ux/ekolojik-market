@echo off
setlocal
cd /d "%~dp0.."
if not defined POS80_QUEUE_NAME set "POS80_QUEUE_NAME=Printer POS-80C"
echo Lima fiş köprüsü — yazici: %POS80_QUEUE_NAME%
node scripts\lima-raw-print-bridge.mjs
pause
