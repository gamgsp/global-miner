@echo off
:: Global Miner - Windows Auto-Start Task & Startup Installer
cd /d "%~dp0\.."

echo [INFO] Installing Global Miner Auto-Start Task...
node cli\autoStart.js install
echo.
echo Setup completed.
pause
