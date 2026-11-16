@echo off
:: Global Miner - Windows Launcher
title Global Miner Client
cd /d "%~dp0\.."

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found in PATH.
    echo Please install Node.js LTS from https://nodejs.org
    pause
    exit /b 1
)

node cli\index.js %*
if %errorlevel% neq 0 (
    pause
)
