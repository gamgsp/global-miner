#!/usr/bin/env bash
# ==============================================================================
# Global Miner - macOS Packaging Script (.dmg / tar)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
APP_NAME="global-miner"
VERSION="1.0.0"

echo "[BUILD:MACOS] Packaging Global Miner v${VERSION} for macOS (Universal)..."
mkdir -p "${DIST_DIR}"

MAC_TMP="${DIST_DIR}/tmp_mac"
rm -rf "${MAC_TMP}"
mkdir -p "${MAC_TMP}/Global Miner.app/Contents/MacOS"
mkdir -p "${MAC_TMP}/Global Miner.app/Contents/Resources/app"

# Copy sources
cp -r "${ROOT_DIR}/cli" "${MAC_TMP}/Global Miner.app/Contents/Resources/app/"
cp -r "${ROOT_DIR}/core" "${MAC_TMP}/Global Miner.app/Contents/Resources/app/"
cp -r "${ROOT_DIR}/gui" "${MAC_TMP}/Global Miner.app/Contents/Resources/app/"
cp -r "${ROOT_DIR}/mac" "${MAC_TMP}/Global Miner.app/Contents/Resources/app/"
cp "${ROOT_DIR}/package.json" "${MAC_TMP}/Global Miner.app/Contents/Resources/app/"
if [ -f "${ROOT_DIR}/metadata_cache.json" ]; then
  cp "${ROOT_DIR}/metadata_cache.json" "${MAC_TMP}/Global Miner.app/Contents/Resources/app/"
fi

# App launcher binary
cat << 'EOF' > "${MAC_TMP}/Global Miner.app/Contents/MacOS/global-miner"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
exec node "${DIR}/cli/index.js" "$@"
EOF
chmod +x "${MAC_TMP}/Global Miner.app/Contents/MacOS/global-miner"

# Info.plist
cat << EOF > "${MAC_TMP}/Global Miner.app/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key>
  <string>global-miner</string>
  <key>CFBundleIdentifier</key>
  <string>us.globaladsmedia.globalminer</string>
  <key>CFBundleName</key>
  <string>Global Miner</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${VERSION}</string>
</dict>
</plist>
EOF

if command -v hdiutil >/dev/null 2>&1; then
  echo "[BUILD:MACOS] Creating .dmg via hdiutil..."
  hdiutil create -volname "Global Miner" -srcfolder "${MAC_TMP}" -ov -format UDZO "${DIST_DIR}/${APP_NAME}-${VERSION}-mac.dmg"
  echo "  ✓ Generated: ${DIST_DIR}/${APP_NAME}-${VERSION}-mac.dmg"
else
  echo "[BUILD:MACOS] hdiutil not available, packaging macOS app archive..."
  tar -czf "${DIST_DIR}/${APP_NAME}-${VERSION}-mac.tar.gz" -C "${MAC_TMP}" "Global Miner.app"
  echo "  ✓ Generated: ${DIST_DIR}/${APP_NAME}-${VERSION}-mac.tar.gz"
fi

rm -rf "${MAC_TMP}"
echo "[BUILD:MACOS] macOS package built successfully!"
