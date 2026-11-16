#!/usr/bin/env bash
# ==============================================================================
# Global Miner - Linux Build & Packaging Script (.deb & .AppImage)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
APP_NAME="global-miner"
VERSION="1.0.0"

echo "[BUILD:LINUX] Packaging Global Miner v${VERSION} for Linux (x86_64)..."
mkdir -p "${DIST_DIR}"

# 1. Clean previous build staging
BUILD_TMP="${DIST_DIR}/tmp_linux"
rm -rf "${BUILD_TMP}"
mkdir -p "${BUILD_TMP}/opt/${APP_NAME}"
mkdir -p "${BUILD_TMP}/usr/local/bin"

# 2. Copy application sources
cp -r "${ROOT_DIR}/cli" "${BUILD_TMP}/opt/${APP_NAME}/"
cp -r "${ROOT_DIR}/core" "${BUILD_TMP}/opt/${APP_NAME}/"
cp -r "${ROOT_DIR}/gui" "${BUILD_TMP}/opt/${APP_NAME}/"
cp -r "${ROOT_DIR}/linux" "${BUILD_TMP}/opt/${APP_NAME}/"
cp "${ROOT_DIR}/package.json" "${BUILD_TMP}/opt/${APP_NAME}/"
if [ -f "${ROOT_DIR}/metadata_cache.json" ]; then
  cp "${ROOT_DIR}/metadata_cache.json" "${BUILD_TMP}/opt/${APP_NAME}/"
fi

# 3. Create launcher script
cat << 'EOF' > "${BUILD_TMP}/usr/local/bin/global-miner"
#!/usr/bin/env bash
exec node /opt/global-miner/cli/index.js "$@"
EOF
chmod +x "${BUILD_TMP}/usr/local/bin/global-miner"

# 4. Build Debian Package (.deb)
DEB_DIR="${BUILD_TMP}/deb_pkg"
mkdir -p "${DEB_DIR}/DEBIAN"
mkdir -p "${DEB_DIR}/opt/${APP_NAME}"
mkdir -p "${DEB_DIR}/usr/bin"
mkdir -p "${DEB_DIR}/usr/share/applications"

cp -r "${BUILD_TMP}/opt/${APP_NAME}/"* "${DEB_DIR}/opt/${APP_NAME}/"
cp "${BUILD_TMP}/usr/local/bin/global-miner" "${DEB_DIR}/usr/bin/global-miner"

cat << EOF > "${DEB_DIR}/DEBIAN/control"
Package: ${APP_NAME}
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: amd64
Maintainer: Global Ads Media, LLC <info@globaladsmedia.us>
Description: Proprietary 133-Algorithm Universal Cryptocurrency Mining Client
 Global Miner delivers high-performance native cryptocurrency mining
 across 133 algorithms with zero-downtime stratum failover and automated GSPC rebates.
EOF

cat << EOF > "${DEB_DIR}/usr/share/applications/${APP_NAME}.desktop"
[Desktop Entry]
Name=Global Miner
Comment=Universal Multi-Platform Crypto Mining Client
Exec=/usr/bin/global-miner
Icon=utilities-terminal
Terminal=true
Type=Application
Categories=Utility;Finance;
EOF

if command -v dpkg-deb >/dev/null 2>&1; then
  echo "[BUILD:LINUX] Assembling .deb package via dpkg-deb..."
  dpkg-deb --build "${DEB_DIR}" "${DIST_DIR}/${APP_NAME}_${VERSION}_amd64.deb"
  echo "  ✓ Generated: ${DIST_DIR}/${APP_NAME}_${VERSION}_amd64.deb"
else
  echo "[BUILD:LINUX] dpkg-deb not available, creating tarball archive instead..."
  tar -czf "${DIST_DIR}/${APP_NAME}_${VERSION}_linux_amd64.tar.gz" -C "${BUILD_TMP}" .
  echo "  ✓ Generated: ${DIST_DIR}/${APP_NAME}_${VERSION}_linux_amd64.tar.gz"
fi

# 5. Build AppImage structure
APPDIR="${BUILD_TMP}/AppDir"
mkdir -p "${APPDIR}/usr/bin"
mkdir -p "${APPDIR}/opt/${APP_NAME}"

cp -r "${BUILD_TMP}/opt/${APP_NAME}/"* "${APPDIR}/opt/${APP_NAME}/"
cp "${BUILD_TMP}/usr/local/bin/global-miner" "${APPDIR}/usr/bin/global-miner"
cp "${DEB_DIR}/usr/share/applications/${APP_NAME}.desktop" "${APPDIR}/${APP_NAME}.desktop"

cat << 'EOF' > "${APPDIR}/AppRun"
#!/usr/bin/env bash
SELF=$(readlink -f "$0")
HERE=${SELF%/*}
export PATH="${HERE}/usr/bin:${PATH}"
exec node "${HERE}/opt/global-miner/cli/index.js" "$@"
EOF
chmod +x "${APPDIR}/AppRun"

# Package AppImage
if command -v appimagetool >/dev/null 2>&1; then
  echo "[BUILD:LINUX] Packaging .AppImage..."
  appimagetool "${APPDIR}" "${DIST_DIR}/${APP_NAME}-${VERSION}-x86_64.AppImage"
else
  # Portable AppImage self-extracting archive
  echo "[BUILD:LINUX] Creating portable standalone AppDir archive..."
  tar -czf "${DIST_DIR}/${APP_NAME}-${VERSION}-x86_64.AppImage.tar.gz" -C "${APPDIR}" .
  echo "  ✓ Generated: ${DIST_DIR}/${APP_NAME}-${VERSION}-x86_64.AppImage.tar.gz"
fi

rm -rf "${BUILD_TMP}"
echo "[BUILD:LINUX] Linux build completed successfully!"
