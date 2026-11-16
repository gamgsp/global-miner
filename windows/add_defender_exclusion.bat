@echo off
:: Global Miner - Windows Defender Exclusion Helper
:: Antivirus engines often falsely flag stratum proxies and mining tools.
:: This helper adds the Global Miner working directory to the Windows Defender whitelist.

cd /d "%~dp0\.."
echo ===================================================================
echo   GLOBAL MINER - Windows Defender Exclusion Helper
echo ===================================================================
echo.
echo Adding "%CD%" to Windows Defender Exclusion List...
echo.

powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command Add-MpPreference -ExclusionPath ''%CD%''' -Verb RunAs"

echo.
echo If prompted by User Account Control (UAC), click YES to confirm.
echo Exclusion command dispatched.
echo.
pause
