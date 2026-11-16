@echo off
REM ==============================================================================
REM Global Miner - Windows Native Build & Packaging Script (.exe / zip)
REM ==============================================================================
setlocal enabledelayedexpansion

set ROOT_DIR=%~dp0..
set DIST_DIR=%ROOT_DIR%\dist
set APP_NAME=global-miner
set VERSION=1.0.0

echo [BUILD:WINDOWS] Packaging Global Miner v%VERSION% for Windows...
if not exist "%DIST_DIR%" mkdir "%DIST_DIR%"

set WIN_TMP=%DIST_DIR%\tmp_win
if exist "%WIN_TMP%" rmdir /s /q "%WIN_TMP%"
mkdir "%WIN_TMP%\%APP_NAME%"

xcopy /E /I /Q "%ROOT_DIR%\cli" "%WIN_TMP%\%APP_NAME%\cli"
xcopy /E /I /Q "%ROOT_DIR%\core" "%WIN_TMP%\%APP_NAME%\core"
xcopy /E /I /Q "%ROOT_DIR%\gui" "%WIN_TMP%\%APP_NAME%\gui"
xcopy /E /I /Q "%ROOT_DIR%\windows" "%WIN_TMP%\%APP_NAME%\windows"
copy /Y "%ROOT_DIR%\package.json" "%WIN_TMP%\%APP_NAME%\"
if exist "%ROOT_DIR%\metadata_cache.json" copy /Y "%ROOT_DIR%\metadata_cache.json" "%WIN_TMP%\%APP_NAME%\"

echo @echo off > "%WIN_TMP%\%APP_NAME%\global-miner.bat"
echo node cli\index.js %%* >> "%WIN_TMP%\%APP_NAME%\global-miner.bat"

powershell -Command "Compress-Archive -Path '%WIN_TMP%\%APP_NAME%' -DestinationPath '%DIST_DIR%\%APP_NAME%-%VERSION%-win-x64.zip' -Force"
echo   [OK] Generated: %DIST_DIR%\%APP_NAME%-%VERSION%-win-x64.zip

rmdir /s /q "%WIN_TMP%"
echo [BUILD:WINDOWS] Windows package built successfully!
