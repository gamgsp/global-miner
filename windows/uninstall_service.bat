@echo off
:: Global Miner - Windows Auto-Start Task Uninstaller
cd /d "%~dp0\.."

echo [INFO] Removing Global Miner Auto-Start Task...
node cli\autoStart.js uninstall
echo.
echo Uninstallation completed.
pause
