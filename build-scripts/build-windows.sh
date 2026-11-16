#!/usr/bin/env bash
# ==============================================================================
# Global Miner - Windows Packaging Script (.exe / zip)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
APP_NAME="global-miner"
VERSION="1.0.0"

echo "[BUILD:WINDOWS] Packaging Global Miner v${VERSION} for Windows (x64)..."
mkdir -p "${DIST_DIR}"

WIN_TMP="${DIST_DIR}/tmp_win"
rm -rf "${WIN_TMP}"
mkdir -p "${WIN_TMP}/${APP_NAME}"

# Copy sources
cp -r "${ROOT_DIR}/cli" "${WIN_TMP}/${APP_NAME}/"
cp -r "${ROOT_DIR}/core" "${WIN_TMP}/${APP_NAME}/"
cp -r "${ROOT_DIR}/gui" "${WIN_TMP}/${APP_NAME}/"
cp -r "${ROOT_DIR}/windows" "${WIN_TMP}/${APP_NAME}/"
cp "${ROOT_DIR}/package.json" "${WIN_TMP}/${APP_NAME}/"
if [ -f "${ROOT_DIR}/metadata_cache.json" ]; then
  cp "${ROOT_DIR}/metadata_cache.json" "${WIN_TMP}/${APP_NAME}/"
fi

# Windows Entrypoint Batch Launcher
cat << 'EOF' > "${WIN_TMP}/${APP_NAME}/global-miner.bat"
@echo off
setlocal
cd /d "%~dp0"
node cli\index.js %*
EOF

# Windows GUI Launcher
cat << 'EOF' > "${WIN_TMP}/${APP_NAME}/global-miner-gui.bat"
@echo off
setlocal
cd /d "%~dp0"
npx electron gui\main.js %*
EOF

# Package Windows Zip / Installer Bundle
echo "[BUILD:WINDOWS] Creating Windows deployment zip..."
(cd "${WIN_TMP}" && zip -r -q "${DIST_DIR}/${APP_NAME}-${VERSION}-win-x64.zip" "${APP_NAME}")
echo "  ✓ Generated: ${DIST_DIR}/${APP_NAME}-${VERSION}-win-x64.zip"

rm -rf "${WIN_TMP}"
echo "[BUILD:WINDOWS] Windows package built successfully!"
